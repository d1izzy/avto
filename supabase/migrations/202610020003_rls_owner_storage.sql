alter table public.tenants enable row level security;
alter table public.tenant_settings enable row level security;
alter table public.tenant_assets enable row level security;
alter table public.services enable row level security;
alter table public.resources enable row level security;
alter table public.service_resources enable row level security;
alter table public.working_hours enable row level security;
alter table public.schedule_exceptions enable row level security;
alter table public.customers enable row level security;
alter table public.vehicles enable row level security;
alter table public.bookings enable row level security;
alter table public.resource_occupancies enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.notification_jobs enable row level security;
alter table public.rate_limits enable row level security;

create policy tenant_member_select on public.tenants for select to authenticated using ((select private.is_tenant_member(id)));
create policy tenant_manager_update on public.tenants for update to authenticated using ((select private.is_tenant_member(id,array['owner','manager']::public.member_role[]))) with check ((select private.is_tenant_member(id,array['owner','manager']::public.member_role[])));
create policy settings_member_all on public.tenant_settings for all to authenticated using ((select private.is_tenant_member(tenant_id,array['owner','manager']::public.member_role[]))) with check ((select private.is_tenant_member(tenant_id,array['owner','manager']::public.member_role[])));
create policy assets_member_all on public.tenant_assets for all to authenticated using ((select private.is_tenant_member(tenant_id,array['owner','manager']::public.member_role[]))) with check ((select private.is_tenant_member(tenant_id,array['owner','manager']::public.member_role[])));
create policy services_member_all on public.services for all to authenticated using ((select private.is_tenant_member(tenant_id))) with check ((select private.is_tenant_member(tenant_id,array['owner','manager']::public.member_role[])));
create policy resources_member_all on public.resources for all to authenticated using ((select private.is_tenant_member(tenant_id))) with check ((select private.is_tenant_member(tenant_id,array['owner','manager']::public.member_role[])));
create policy service_resources_member_all on public.service_resources for all to authenticated using ((select private.is_tenant_member(tenant_id))) with check ((select private.is_tenant_member(tenant_id,array['owner','manager']::public.member_role[])));
create policy working_hours_member_all on public.working_hours for all to authenticated using ((select private.is_tenant_member(tenant_id))) with check ((select private.is_tenant_member(tenant_id,array['owner','manager']::public.member_role[])));
create policy exceptions_member_all on public.schedule_exceptions for all to authenticated using ((select private.is_tenant_member(tenant_id))) with check ((select private.is_tenant_member(tenant_id)));
create policy customers_member_select on public.customers for select to authenticated using ((select private.is_tenant_member(tenant_id)));
create policy vehicles_member_select on public.vehicles for select to authenticated using ((select private.is_tenant_member(tenant_id)));
create policy bookings_member_all on public.bookings for all to authenticated using ((select private.is_tenant_member(tenant_id))) with check ((select private.is_tenant_member(tenant_id)));
create policy occupancies_member_all on public.resource_occupancies for all to authenticated using ((select private.is_tenant_member(tenant_id))) with check ((select private.is_tenant_member(tenant_id)));
create policy memberships_self_select on public.tenant_memberships for select to authenticated using (user_id=(select auth.uid()));
create policy notifications_member_select on public.notification_jobs for select to authenticated using ((select private.is_tenant_member(tenant_id,array['owner','manager']::public.member_role[])));

grant usage on schema public to anon,authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
revoke all on public.customers,public.vehicles,public.bookings,public.resource_occupancies,public.tenant_memberships,public.notification_jobs,public.rate_limits from anon;

create or replace function public.owner_list_bookings(p_slug text) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_tenant_id uuid;
begin
  select id into v_tenant_id from public.tenants where slug=p_slug;
  if not found or not private.is_tenant_member(v_tenant_id) then raise exception 'FORBIDDEN' using errcode='P0001'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'status',b.status,'starts_at',b.starts_at,'ends_at',b.ends_at,'price',b.price,'currency',b.currency,'service_name',b.service_name_snapshot,'resource_name',r.name,'tenant_name',t.name,'tenant_slug',t.slug,'address',t.address,'customer_name',b.customer_name_snapshot,'customer_phone',b.customer_phone_snapshot,'customer_email',b.customer_email_snapshot,'vehicle',b.vehicle_snapshot,'created_at',b.created_at,'can_cancel',false,'can_reschedule',false) order by b.starts_at desc) from public.bookings b join public.resources r on r.id=b.resource_id join public.tenants t on t.id=b.tenant_id where b.tenant_id=v_tenant_id),'[]'::jsonb);
end; $$;

create or replace function public.owner_catalog(p_slug text) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_tenant_id uuid;
begin select id into v_tenant_id from public.tenants where slug=p_slug; if not found or not private.is_tenant_member(v_tenant_id) then raise exception 'FORBIDDEN' using errcode='P0001'; end if;
return jsonb_build_object('services',coalesce((select jsonb_agg(to_jsonb(s) order by sort_order) from public.services s where tenant_id=v_tenant_id),'[]'::jsonb),'resources',coalesce((select jsonb_agg(to_jsonb(r) order by sort_order) from public.resources r where tenant_id=v_tenant_id),'[]'::jsonb)); end; $$;

create or replace function public.owner_update_booking_status(p_booking_id uuid,p_status public.booking_status) returns void language plpgsql security invoker set search_path = '' as $$
declare v_tenant_id uuid; begin select tenant_id into v_tenant_id from public.bookings where id=p_booking_id; if not found or not private.is_tenant_member(v_tenant_id) then raise exception 'FORBIDDEN' using errcode='P0001'; end if;
update public.bookings set status=p_status,updated_at=now(),cancelled_at=case when p_status='cancelled' then now() else cancelled_at end where id=p_booking_id;
if p_status in ('cancelled','completed','no_show') then update public.resource_occupancies set active=false where booking_id=p_booking_id and active; end if; end; $$;

create or replace function public.owner_upsert_service(p_slug text,p_service jsonb) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_tenant public.tenants; v_id uuid; begin select * into v_tenant from public.tenants where slug=p_slug; if not found or not private.is_tenant_member(v_tenant.id,array['owner','manager']::public.member_role[]) then raise exception 'FORBIDDEN' using errcode='P0001'; end if;
v_id:=nullif(p_service->>'id','')::uuid; if v_id is null then insert into public.services(tenant_id,name,description,price,currency,duration_minutes,buffer_before_minutes,buffer_after_minutes,active) values(v_tenant.id,p_service->>'name',p_service->>'description',coalesce((p_service->>'price')::numeric,0),coalesce(p_service->>'currency',v_tenant.currency),coalesce((p_service->>'duration_minutes')::int,60),coalesce((p_service->>'buffer_before_minutes')::int,0),coalesce((p_service->>'buffer_after_minutes')::int,0),coalesce((p_service->>'active')::boolean,true)) returning id into v_id;
else update public.services set name=coalesce(p_service->>'name',name),description=coalesce(p_service->>'description',description),price=coalesce((p_service->>'price')::numeric,price),duration_minutes=coalesce((p_service->>'duration_minutes')::int,duration_minutes),active=coalesce((p_service->>'active')::boolean,active),updated_at=now() where id=v_id and tenant_id=v_tenant.id; end if; return v_id; end; $$;

create or replace function public.owner_upsert_resource(p_slug text,p_resource jsonb) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_tenant_id uuid; v_id uuid; begin select id into v_tenant_id from public.tenants where slug=p_slug; if not found or not private.is_tenant_member(v_tenant_id,array['owner','manager']::public.member_role[]) then raise exception 'FORBIDDEN' using errcode='P0001'; end if;
v_id:=nullif(p_resource->>'id','')::uuid; if v_id is null then insert into public.resources(tenant_id,name,type,description,active,capacity) values(v_tenant_id,p_resource->>'name',p_resource->>'type',p_resource->>'description',coalesce((p_resource->>'active')::boolean,true),coalesce((p_resource->>'capacity')::int,1)) returning id into v_id;
else update public.resources set name=coalesce(p_resource->>'name',name),type=coalesce(p_resource->>'type',type),description=coalesce(p_resource->>'description',description),active=coalesce((p_resource->>'active')::boolean,active),updated_at=now() where id=v_id and tenant_id=v_tenant_id; end if; return v_id; end; $$;

revoke all on function public.owner_list_bookings(text), public.owner_catalog(text), public.owner_update_booking_status(uuid,public.booking_status), public.owner_upsert_service(text,jsonb), public.owner_upsert_resource(text,jsonb) from public,anon;
grant execute on function public.owner_list_bookings(text), public.owner_catalog(text), public.owner_update_booking_status(uuid,public.booking_status), public.owner_upsert_service(text,jsonb), public.owner_upsert_resource(text,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('tenant-assets','tenant-assets',true,10485760,array['image/jpeg','image/png','image/webp','image/svg+xml']) on conflict(id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit) values('owner-private','owner-private',false,20971520) on conflict(id) do nothing;
create policy tenant_assets_public_read on storage.objects for select to anon,authenticated using(bucket_id='tenant-assets');
create policy tenant_assets_member_insert on storage.objects for insert to authenticated with check(bucket_id='tenant-assets' and private.is_tenant_member((storage.foldername(name))[1]::uuid,array['owner','manager']::public.member_role[]));
create policy tenant_assets_member_update on storage.objects for update to authenticated using(bucket_id='tenant-assets' and private.is_tenant_member((storage.foldername(name))[1]::uuid,array['owner','manager']::public.member_role[])) with check(bucket_id='tenant-assets' and private.is_tenant_member((storage.foldername(name))[1]::uuid,array['owner','manager']::public.member_role[]));
create policy owner_private_member_all on storage.objects for all to authenticated using(bucket_id='owner-private' and private.is_tenant_member((storage.foldername(name))[1]::uuid)) with check(bucket_id='owner-private' and private.is_tenant_member((storage.foldername(name))[1]::uuid));
