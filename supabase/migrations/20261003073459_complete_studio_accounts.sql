-- Customers and owners are the only application roles. Existing enum values stay for migration compatibility.
create or replace function private.is_tenant_member(p_tenant_id uuid, p_roles public.member_role[] default null)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.tenant_memberships m where m.tenant_id=p_tenant_id and m.user_id=(select auth.uid()) and m.role='owner' and (p_roles is null or m.role=any(p_roles)));
$$;

alter table public.tenants add column content jsonb not null default '{}'::jsonb;
alter table public.services add column deleted_at timestamptz;
alter table public.resources add column deleted_at timestamptz;
alter table public.customers add column deleted_at timestamptz;
alter table public.bookings add column deleted_at timestamptz;

create table public.customer_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 name text not null default '' check(length(name)<=100),
 phone text not null default '' check(length(phone)<=30),
 vehicle_brand text not null default '' check(length(vehicle_brand)<=80),
 vehicle_model text not null default '' check(length(vehicle_model)<=80),
 license_plate text not null default '' check(length(license_plate)<=20)
);
alter table public.customer_profiles enable row level security;
revoke all on public.customer_profiles from anon,authenticated;
grant select,insert,update,delete on public.customer_profiles to authenticated;
create policy profile_self on public.customer_profiles for all to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

-- Capability links remain private; knowing an email or phone never grants ownership of a booking.
create table private.customer_booking_links (
 user_id uuid not null references auth.users(id) on delete cascade,
 booking_id uuid not null references public.bookings(id) on delete cascade,
 token text not null check(length(token)=64),
 created_at timestamptz not null default now(),
 primary key(user_id,booking_id)
);
create index customer_booking_links_booking_idx on private.customer_booking_links(booking_id);
alter table private.customer_booking_links enable row level security;
revoke all on private.customer_booking_links from public,anon,authenticated;
grant select on private.customer_booking_links to authenticated;
create policy links_self_select on private.customer_booking_links for select to authenticated using(user_id=(select auth.uid()));

create function private.claim_customer_booking(p_token text) returns void language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
 if p_token is null or length(p_token)<>64 then raise exception 'BOOKING_NOT_FOUND'; end if;
 select id into v_id from public.bookings where access_token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if v_id is null then raise exception 'BOOKING_NOT_FOUND'; end if;
 insert into private.customer_booking_links(user_id,booking_id,token) values(auth.uid(),v_id,p_token) on conflict do nothing;
end; $$;
revoke all on function private.claim_customer_booking(text) from public,anon;
grant execute on function private.claim_customer_booking(text) to authenticated;
create function public.customer_claim_booking(p_token text) returns void language sql security invoker set search_path='' as $$select private.claim_customer_booking(p_token);$$;
create function public.customer_saved_bookings(p_slug text) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('token',l.token,'booking',public.get_public_booking(l.token)) order by l.created_at desc),'[]'::jsonb)
 from private.customer_booking_links l where l.user_id=(select auth.uid()) and public.get_public_booking(l.token)->>'tenant_slug'=p_slug;
$$;
revoke all on function public.customer_claim_booking(text),public.customer_saved_bookings(text) from public,anon;
grant execute on function public.customer_claim_booking(text),public.customer_saved_bookings(text) to authenticated;

create policy customers_owner_write on public.customers for all to authenticated
 using((select private.is_tenant_member(tenant_id))) with check((select private.is_tenant_member(tenant_id)));

create or replace function public.owner_delete_service(p_slug text,p_service_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_tenant uuid;
begin
 select id into v_tenant from public.tenants where slug=p_slug;
 if not private.is_tenant_member(v_tenant) then raise exception 'FORBIDDEN'; end if;
 update public.services set active=false,deleted_at=now(),updated_at=now() where id=p_service_id and tenant_id=v_tenant;
 if not found then raise exception 'SERVICE_NOT_FOUND'; end if;
 return jsonb_build_object('action','archived');
end;$$;
create or replace function public.owner_delete_resource(p_slug text,p_resource_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_tenant uuid;
begin
 select id into v_tenant from public.tenants where slug=p_slug;
 if not private.is_tenant_member(v_tenant) then raise exception 'FORBIDDEN'; end if;
 if exists(select 1 from public.bookings where tenant_id=v_tenant and resource_id=p_resource_id and status in ('confirmed','in_progress') and ends_at>now()) then raise exception 'RESOURCE_HAS_BOOKINGS'; end if;
 update public.resources set active=false,deleted_at=now(),updated_at=now() where id=p_resource_id and tenant_id=v_tenant;
 if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
 return jsonb_build_object('action','archived');
end;$$;

create or replace function public.owner_list_bookings(p_slug text) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_tenant uuid;
begin
 select id into v_tenant from public.tenants where slug=p_slug;
 if not private.is_tenant_member(v_tenant) then raise exception 'FORBIDDEN'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
 'id',b.id,'service_id',b.service_id,'resource_id',b.resource_id,'customer_id',b.customer_id,'deleted_at',b.deleted_at,
 'status',b.status,'starts_at',b.starts_at,'ends_at',b.ends_at,'price',b.price,'currency',b.currency,
 'service_name',b.service_name_snapshot,'resource_name',r.name,'tenant_name',t.name,'tenant_slug',t.slug,'address',t.address,
 'customer_name',b.customer_name_snapshot,'customer_phone',b.customer_phone_snapshot,'customer_email',b.customer_email_snapshot,
 'vehicle',b.vehicle_snapshot,'created_at',b.created_at,'can_cancel',false,'can_reschedule',false) order by b.starts_at desc)
 from public.bookings b join public.resources r on r.id=b.resource_id join public.tenants t on t.id=b.tenant_id where b.tenant_id=v_tenant),'[]'::jsonb);
end;$$;

-- Saving a service and its compatible boxes is one transaction.
create function public.owner_save_service(p_slug text,p_service jsonb,p_resources uuid[]) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_tenant uuid; v_id uuid; v_res uuid;
begin
 select id into v_tenant from public.tenants where slug=p_slug;
 if not private.is_tenant_member(v_tenant) then raise exception 'FORBIDDEN'; end if;
 if coalesce((p_service->>'active')::boolean,true) and coalesce(cardinality(p_resources),0)=0 then raise exception 'RESOURCE_REQUIRED'; end if;
 foreach v_res in array coalesce(p_resources,array[]::uuid[]) loop
  if not exists(select 1 from public.resources where id=v_res and tenant_id=v_tenant and active and deleted_at is null) then raise exception 'RESOURCE_NOT_FOUND'; end if;
 end loop;
 v_id:=public.owner_upsert_service(p_slug,p_service);
 update public.services set
 buffer_before_minutes=coalesce((p_service->>'buffer_before_minutes')::int,buffer_before_minutes),
 buffer_after_minutes=coalesce((p_service->>'buffer_after_minutes')::int,buffer_after_minutes),
 sort_order=coalesce((p_service->>'sort_order')::int,sort_order)
 where id=v_id and tenant_id=v_tenant;
 if not found then raise exception 'SERVICE_NOT_FOUND'; end if;
 delete from public.service_resources where tenant_id=v_tenant and service_id=v_id;
 insert into public.service_resources(tenant_id,service_id,resource_id) select v_tenant,v_id,unnest(p_resources);
 return v_id;
end;$$;

create function public.owner_save_booking(p_slug text,p_booking jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare t public.tenants; s public.services; b public.bookings; r public.resources;
 v_id uuid; v_start timestamptz; v_end timestamptz; v_customer uuid; v_created jsonb; v_status public.booking_status;
begin
 select * into t from public.tenants where slug=p_slug;
 if t.id is null or not private.is_tenant_member(t.id) then raise exception 'FORBIDDEN'; end if;
 select * into s from public.services where id=(p_booking->>'service_id')::uuid and tenant_id=t.id;
 select * into r from public.resources where id=(p_booking->>'resource_id')::uuid and tenant_id=t.id;
 if s.id is null or r.id is null then raise exception 'VALIDATION_ERROR'; end if;
 if length(trim(p_booking->>'customer_name'))<2 or length(trim(p_booking->>'customer_phone'))<7 then raise exception 'VALIDATION_ERROR'; end if;
 v_start:=(p_booking->>'starts_at')::timestamptz;
 v_end:=v_start+make_interval(mins=>s.duration_minutes);
 v_status:=coalesce((p_booking->>'status')::public.booking_status,'confirmed');
 v_id:=nullif(p_booking->>'id','')::uuid;
 if v_id is null then
   v_created:=public.create_public_booking(p_slug,s.id,r.id,v_start,p_booking->>'customer_name',p_booking->>'customer_phone',p_booking->>'customer_email',p_booking->'vehicle',coalesce((p_booking->>'idempotency_key')::uuid,extensions.gen_random_uuid()));
   v_id:=(v_created->>'booking_id')::uuid;
 else
   select * into b from public.bookings where id=v_id and tenant_id=t.id for update;
   if b.id is null then raise exception 'BOOKING_NOT_FOUND'; end if;
   if v_status in ('confirmed','in_progress') and (b.starts_at<>v_start or b.resource_id<>r.id or b.service_id<>s.id or b.status not in ('confirmed','in_progress')) then
     if not s.active or not r.active or not exists(select 1 from public.service_resources where tenant_id=t.id and service_id=s.id and resource_id=r.id) then raise exception 'SERVICE_NOT_AVAILABLE'; end if;
     if v_start<now() or not exists(select 1 from public.working_hours h where h.tenant_id=t.id and h.active
       and h.weekday=extract(dow from v_start at time zone t.timezone)
       and (v_start-make_interval(mins=>s.buffer_before_minutes)) at time zone t.timezone >= ((v_start at time zone t.timezone)::date+h.start_time)
       and (v_end+make_interval(mins=>s.buffer_after_minutes)) at time zone t.timezone <= ((v_start at time zone t.timezone)::date+h.end_time))
       or exists(select 1 from public.schedule_exceptions e where e.tenant_id=t.id and (e.resource_id is null or e.resource_id=r.id) and e.date=(v_start at time zone t.timezone)::date
       and (e.start_time is null or tstzrange((e.date+e.start_time) at time zone t.timezone,(e.date+e.end_time) at time zone t.timezone,'[)') && tstzrange(v_start,v_end,'[)')))
       then raise exception 'BOOKING_SLOT_UNAVAILABLE'; end if;
   end if;
 end if;
 insert into public.customers(tenant_id,name,phone,email) values(t.id,trim(p_booking->>'customer_name'),trim(p_booking->>'customer_phone'),nullif(p_booking->>'customer_email',''))
 on conflict(tenant_id,phone) do update set name=excluded.name,email=excluded.email,deleted_at=null,updated_at=now() returning id into v_customer;
 update public.bookings set customer_id=v_customer,customer_name_snapshot=trim(p_booking->>'customer_name'),customer_phone_snapshot=trim(p_booking->>'customer_phone'),
 customer_email_snapshot=nullif(p_booking->>'customer_email',''),vehicle_snapshot=p_booking->'vehicle',
 service_id=s.id,resource_id=r.id,service_name_snapshot=s.name,starts_at=v_start,ends_at=v_end,
 price=coalesce((p_booking->>'price')::numeric,s.price),status=v_status,updated_at=now(),
 cancelled_at=case when v_status='cancelled' then now() else null end
 where id=v_id and tenant_id=t.id;
 -- Reinsert even a formerly inactive occupancy; the exclusion constraint prevents double booking.
 delete from public.resource_occupancies where booking_id=v_id and tenant_id=t.id;
 if v_status in ('confirmed','in_progress') then
 insert into public.resource_occupancies(tenant_id,resource_id,booking_id,occupancy_type,starts_at,ends_at,reason)
 values(t.id,r.id,v_id,'booking',v_start-make_interval(mins=>s.buffer_before_minutes),v_end+make_interval(mins=>s.buffer_after_minutes),'Owner booking');
 end if;
 return v_id;
exception when exclusion_violation then raise exception 'BOOKING_SLOT_UNAVAILABLE';
end;$$;

create function public.owner_archive_booking(p_slug text,p_id uuid) returns void language plpgsql security invoker set search_path='' as $$
declare v_tenant uuid;
begin
 select id into v_tenant from public.tenants where slug=p_slug;
 if not private.is_tenant_member(v_tenant) then raise exception 'FORBIDDEN'; end if;
 update public.bookings set deleted_at=now(),status=case when status in ('confirmed','in_progress') then 'cancelled'::public.booking_status else status end,updated_at=now() where id=p_id and tenant_id=v_tenant;
 if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
 update public.resource_occupancies set active=false where booking_id=p_id and tenant_id=v_tenant;
end;$$;
revoke all on function public.owner_save_service(text,jsonb,uuid[]),public.owner_save_booking(text,jsonb),public.owner_archive_booking(text,uuid) from public,anon;
grant execute on function public.owner_save_service(text,jsonb,uuid[]),public.owner_save_booking(text,jsonb),public.owner_archive_booking(text,uuid) to authenticated;

create policy tenant_assets_owner_delete on storage.objects for delete to authenticated
 using(bucket_id='tenant-assets' and private.is_tenant_member((storage.foldername(name))[1]::uuid));

-- Match the supplied blue card reference. Photos are editable examples, not claims of completed work.
update public.tenants set accent_color='#4285ff' where slug='graphite';
update public.tenant_assets set alt_text=alt_text||' — пример' where tenant_id=(select id from public.tenants where slug='graphite') and storage_path in ('external/demo-1','external/demo-2','external/demo-3') and alt_text not like '%пример%';
