create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.is_tenant_member(p_tenant_id uuid, p_roles public.member_role[] default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.tenant_memberships m where m.tenant_id = p_tenant_id and m.user_id = (select auth.uid()) and (p_roles is null or m.role = any(p_roles)));
$$;

create or replace function public.get_public_tenant(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'tenant', to_jsonb(t), 'settings', to_jsonb(s),
    'services', coalesce((select jsonb_agg(to_jsonb(x) order by x.sort_order) from public.services x where x.tenant_id=t.id and x.active), '[]'::jsonb),
    'hours', coalesce((select jsonb_agg(to_jsonb(h) - 'id' - 'tenant_id' order by h.weekday,h.start_time) from public.working_hours h where h.tenant_id=t.id), '[]'::jsonb),
    'assets', coalesce((select jsonb_agg(to_jsonb(a) - 'id' - 'tenant_id' - 'storage_path' order by a.sort_order) from public.tenant_assets a where a.tenant_id=t.id), '[]'::jsonb)
  ) from public.tenants t join public.tenant_settings s on s.tenant_id=t.id where t.slug=p_slug and t.status in ('preview','live');
$$;

create or replace function public.get_availability(p_slug text, p_service_id uuid, p_local_date date)
returns table(starts_at timestamptz, ends_at timestamptz, resource_id uuid, resource_name text)
language plpgsql security definer set search_path = '' as $$
declare v_tenant public.tenants; v_service public.services; v_settings public.tenant_settings;
begin
  select * into v_tenant from public.tenants where slug=p_slug and status in ('preview','live');
  if not found then raise exception 'TENANT_NOT_FOUND' using errcode='P0001'; end if;
  select * into v_settings from public.tenant_settings where tenant_id=v_tenant.id;
  if not v_settings.booking_enabled then return; end if;
  select * into v_service from public.services where id=p_service_id and tenant_id=v_tenant.id and active;
  if not found then raise exception 'SERVICE_NOT_AVAILABLE' using errcode='P0001'; end if;
  if p_local_date < (now() at time zone v_tenant.timezone)::date or p_local_date > (now() at time zone v_tenant.timezone)::date + v_settings.maximum_booking_days then return; end if;
  return query
  with bounds as (
    select r.id resource_id, r.name resource_name,
      (p_local_date + wh.start_time) at time zone v_tenant.timezone as opens_at,
      (p_local_date + wh.end_time) at time zone v_tenant.timezone as closes_at
    from public.service_resources sr join public.resources r on r.id=sr.resource_id and r.tenant_id=sr.tenant_id
    join public.working_hours wh on wh.tenant_id=v_tenant.id and wh.weekday=extract(dow from p_local_date)::int and wh.active
    where sr.tenant_id=v_tenant.id and sr.service_id=v_service.id and r.active
  ), slots as (
    select b.resource_id,b.resource_name,gs starts_at,
      gs + make_interval(mins => v_service.duration_minutes) ends_at,
      gs - make_interval(mins => v_service.buffer_before_minutes) occupied_start,
      gs + make_interval(mins => v_service.duration_minutes + v_service.buffer_after_minutes) occupied_end,
      b.closes_at
    from bounds b cross join lateral generate_series(b.opens_at, b.closes_at - make_interval(mins => v_service.duration_minutes), make_interval(mins => v_settings.slot_interval_minutes)) gs
  )
  select s.starts_at,s.ends_at,s.resource_id,s.resource_name from slots s
  where s.occupied_end <= s.closes_at
    and s.starts_at >= now() + make_interval(mins => v_settings.minimum_booking_notice_minutes)
    and not exists(select 1 from public.resource_occupancies o where o.tenant_id=v_tenant.id and o.resource_id=s.resource_id and o.active and tstzrange(o.starts_at,o.ends_at,'[)') && tstzrange(s.occupied_start,s.occupied_end,'[)'))
    and not exists(select 1 from public.schedule_exceptions e where e.tenant_id=v_tenant.id and (e.resource_id is null or e.resource_id=s.resource_id) and e.date=p_local_date and (e.start_time is null or tstzrange((e.date+e.start_time) at time zone v_tenant.timezone,(e.date+e.end_time) at time zone v_tenant.timezone,'[)') && tstzrange(s.occupied_start,s.occupied_end,'[)')))
  order by s.starts_at,s.resource_name;
end; $$;

create or replace function public.create_public_booking(
  p_slug text, p_service_id uuid, p_resource_id uuid, p_requested_start timestamptz, p_customer_name text, p_customer_phone text,
  p_customer_email text, p_vehicle jsonb, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tenant public.tenants; v_settings public.tenant_settings; v_service public.services; v_resource public.resources;
  v_customer_id uuid; v_vehicle_id uuid; v_booking_id uuid; v_end timestamptz; v_occ_start timestamptz; v_occ_end timestamptz;
  v_token text; v_local_start timestamp; v_local_end timestamp; v_existing uuid;
begin
  if length(trim(p_customer_name)) < 2 or length(trim(p_customer_phone)) < 7 then raise exception 'VALIDATION_ERROR' using errcode='P0001'; end if;
  select * into v_tenant from public.tenants where slug=p_slug and status in ('preview','live');
  if not found then raise exception 'TENANT_NOT_FOUND' using errcode='P0001'; end if;
  v_token := encode(extensions.digest(p_idempotency_key::text || ':' || v_tenant.id::text || ':booking-access-v1','sha256'),'hex');
  select id into v_existing from public.bookings where tenant_id=v_tenant.id and idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('booking_id',v_existing,'token',v_token,'idempotent',true); end if;
  select * into v_settings from public.tenant_settings where tenant_id=v_tenant.id and booking_enabled;
  if not found then raise exception 'SERVICE_NOT_AVAILABLE' using errcode='P0001'; end if;
  select * into v_service from public.services where id=p_service_id and tenant_id=v_tenant.id and active;
  if not found then raise exception 'SERVICE_NOT_AVAILABLE' using errcode='P0001'; end if;
  select r.* into v_resource from public.resources r join public.service_resources sr on sr.resource_id=r.id and sr.tenant_id=r.tenant_id where r.id=p_resource_id and r.tenant_id=v_tenant.id and r.active and sr.service_id=v_service.id;
  if not found then raise exception 'RESOURCE_NOT_FOUND' using errcode='P0001'; end if;
  v_end := p_requested_start + make_interval(mins => v_service.duration_minutes);
  v_occ_start := p_requested_start - make_interval(mins => v_service.buffer_before_minutes); v_occ_end := v_end + make_interval(mins => v_service.buffer_after_minutes);
  v_local_start := p_requested_start at time zone v_tenant.timezone; v_local_end := v_end at time zone v_tenant.timezone;
  if p_requested_start < now() + make_interval(mins => v_settings.minimum_booking_notice_minutes) or v_local_start::date > (now() at time zone v_tenant.timezone)::date + v_settings.maximum_booking_days then raise exception 'BOOKING_SLOT_UNAVAILABLE' using errcode='P0001'; end if;
  if v_local_start::date <> v_local_end::date or not exists(select 1 from public.working_hours h where h.tenant_id=v_tenant.id and h.weekday=extract(dow from v_local_start)::int and h.active and v_local_start::time >= h.start_time and v_local_end::time <= h.end_time) then raise exception 'BOOKING_SLOT_UNAVAILABLE' using errcode='P0001'; end if;
  if exists(select 1 from public.schedule_exceptions e where e.tenant_id=v_tenant.id and (e.resource_id is null or e.resource_id=v_resource.id) and e.date=v_local_start::date and (e.start_time is null or tsrange(e.date+e.start_time,e.date+e.end_time,'[)') && tsrange(v_local_start,v_local_end,'[)'))) then raise exception 'BOOKING_SLOT_UNAVAILABLE' using errcode='P0001'; end if;
  insert into public.customers(tenant_id,name,phone,email) values(v_tenant.id,trim(p_customer_name),trim(p_customer_phone),nullif(trim(p_customer_email),''))
    on conflict(tenant_id,phone) do update set name=excluded.name,email=coalesce(excluded.email,public.customers.email),updated_at=now() returning id into v_customer_id;
  insert into public.vehicles(tenant_id,customer_id,brand,model,year,license_plate,color,notes) values(v_tenant.id,v_customer_id,p_vehicle->>'brand',p_vehicle->>'model',nullif(p_vehicle->>'year','')::int,nullif(p_vehicle->>'license_plate',''),nullif(p_vehicle->>'color',''),nullif(p_vehicle->>'notes','')) returning id into v_vehicle_id;
  insert into public.bookings(tenant_id,customer_id,vehicle_id,service_id,resource_id,starts_at,ends_at,price,currency,customer_name_snapshot,customer_phone_snapshot,customer_email_snapshot,vehicle_snapshot,service_name_snapshot,access_token_hash,idempotency_key)
    values(v_tenant.id,v_customer_id,v_vehicle_id,v_service.id,v_resource.id,p_requested_start,v_end,v_service.price,v_service.currency,trim(p_customer_name),trim(p_customer_phone),nullif(trim(p_customer_email),''),p_vehicle,v_service.name,encode(extensions.digest(v_token,'sha256'),'hex'),p_idempotency_key) returning id into v_booking_id;
  begin
    insert into public.resource_occupancies(tenant_id,resource_id,booking_id,occupancy_type,starts_at,ends_at,reason) values(v_tenant.id,v_resource.id,v_booking_id,'booking',v_occ_start,v_occ_end,'Customer booking');
  exception when exclusion_violation then raise exception 'BOOKING_SLOT_UNAVAILABLE' using errcode='P0001'; end;
  insert into public.notification_jobs(tenant_id,booking_id,type,channel,payload,dedupe_key) values(v_tenant.id,v_booking_id,'booking_created','email',jsonb_build_object('booking_id',v_booking_id),'booking-created:'||v_booking_id) on conflict do nothing;
  return jsonb_build_object('booking_id',v_booking_id,'token',v_token,'idempotent',false);
end; $$;

create or replace function public.get_public_booking(p_token text) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',b.id,'status',b.status,'starts_at',b.starts_at,'ends_at',b.ends_at,'price',b.price,'currency',b.currency,
    'service_name',b.service_name_snapshot,'resource_name',r.name,'tenant_name',t.name,'tenant_slug',t.slug,'address',t.address,'customer_name',b.customer_name_snapshot,'vehicle',b.vehicle_snapshot,
    'can_cancel',(s.customer_can_cancel and b.status='confirmed' and b.starts_at > now()+make_interval(mins=>s.cancellation_deadline_minutes)),
    'can_reschedule',(s.customer_can_reschedule and s.reschedule_enabled and b.status='confirmed' and b.starts_at > now()+make_interval(mins=>s.cancellation_deadline_minutes)))
  from public.bookings b join public.tenants t on t.id=b.tenant_id join public.tenant_settings s on s.tenant_id=t.id join public.resources r on r.id=b.resource_id
  where b.access_token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
$$;

create or replace function public.cancel_public_booking(p_token text) returns void language plpgsql security definer set search_path = '' as $$
declare v_booking public.bookings; v_settings public.tenant_settings;
begin
  select * into v_booking from public.bookings where access_token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode='P0001'; end if;
  if v_booking.status='cancelled' then raise exception 'BOOKING_ALREADY_CANCELLED' using errcode='P0001'; end if;
  select * into v_settings from public.tenant_settings where tenant_id=v_booking.tenant_id;
  if not v_settings.customer_can_cancel or v_booking.starts_at <= now()+make_interval(mins=>v_settings.cancellation_deadline_minutes) then raise exception 'FORBIDDEN' using errcode='P0001'; end if;
  update public.bookings set status='cancelled',cancelled_at=now(),updated_at=now() where id=v_booking.id;
  update public.resource_occupancies set active=false where booking_id=v_booking.id and active;
end; $$;

create or replace function public.reschedule_public_booking(p_token text,p_requested_start timestamptz,p_resource_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_booking public.bookings; v_service public.services; v_settings public.tenant_settings; v_tenant public.tenants; v_end timestamptz;
begin
  select * into v_booking from public.bookings where access_token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode='P0001'; end if;
  select * into v_settings from public.tenant_settings where tenant_id=v_booking.tenant_id; select * into v_tenant from public.tenants where id=v_booking.tenant_id; select * into v_service from public.services where id=v_booking.service_id;
  if not v_settings.reschedule_enabled or not v_settings.customer_can_reschedule or v_booking.status<>'confirmed' then raise exception 'BOOKING_RESCHEDULE_NOT_ALLOWED' using errcode='P0001'; end if;
  if not exists(select 1 from public.service_resources where tenant_id=v_booking.tenant_id and service_id=v_booking.service_id and resource_id=p_resource_id) then raise exception 'RESOURCE_NOT_FOUND' using errcode='P0001'; end if;
  v_end:=p_requested_start+make_interval(mins=>v_service.duration_minutes);
  begin
    update public.resource_occupancies set resource_id=p_resource_id,starts_at=p_requested_start-make_interval(mins=>v_service.buffer_before_minutes),ends_at=v_end+make_interval(mins=>v_service.buffer_after_minutes) where booking_id=v_booking.id and active;
    update public.bookings set resource_id=p_resource_id,starts_at=p_requested_start,ends_at=v_end,updated_at=now() where id=v_booking.id;
  exception when exclusion_violation then raise exception 'BOOKING_SLOT_UNAVAILABLE' using errcode='P0001'; end;
end; $$;

revoke all on function public.get_public_tenant(text) from public; grant execute on function public.get_public_tenant(text) to anon,authenticated;
revoke all on function public.get_availability(text,uuid,date) from public; grant execute on function public.get_availability(text,uuid,date) to anon,authenticated;
revoke all on function public.create_public_booking(text,uuid,uuid,timestamptz,text,text,text,jsonb,uuid) from public; grant execute on function public.create_public_booking(text,uuid,uuid,timestamptz,text,text,text,jsonb,uuid) to anon,authenticated;
revoke all on function public.get_public_booking(text) from public; grant execute on function public.get_public_booking(text) to anon,authenticated;
revoke all on function public.cancel_public_booking(text) from public; grant execute on function public.cancel_public_booking(text) to anon,authenticated;
revoke all on function public.reschedule_public_booking(text,timestamptz,uuid) from public; grant execute on function public.reschedule_public_booking(text,timestamptz,uuid) to anon,authenticated;
