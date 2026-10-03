create or replace function public.owner_delete_service(p_slug text, p_service_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_tenant_id uuid; v_has_bookings boolean;
begin
  select id into v_tenant_id from public.tenants where slug=p_slug;
  if v_tenant_id is null or not private.is_tenant_member(v_tenant_id, array['owner','manager']::public.member_role[]) then raise exception 'FORBIDDEN' using errcode='P0001'; end if;
  if not exists (select 1 from public.services where id=p_service_id and tenant_id=v_tenant_id) then raise exception 'SERVICE_NOT_FOUND' using errcode='P0001'; end if;
  select exists(select 1 from public.bookings where tenant_id=v_tenant_id and service_id=p_service_id) into v_has_bookings;
  if v_has_bookings then update public.services set active=false,updated_at=now() where id=p_service_id and tenant_id=v_tenant_id; return jsonb_build_object('action','archived'); end if;
  delete from public.services where id=p_service_id and tenant_id=v_tenant_id; return jsonb_build_object('action','deleted');
end; $$;

create or replace function public.owner_delete_resource(p_slug text, p_resource_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_tenant_id uuid; v_has_bookings boolean;
begin
  select id into v_tenant_id from public.tenants where slug=p_slug;
  if v_tenant_id is null or not private.is_tenant_member(v_tenant_id, array['owner','manager']::public.member_role[]) then raise exception 'FORBIDDEN' using errcode='P0001'; end if;
  if not exists (select 1 from public.resources where id=p_resource_id and tenant_id=v_tenant_id) then raise exception 'RESOURCE_NOT_FOUND' using errcode='P0001'; end if;
  select exists(select 1 from public.bookings where tenant_id=v_tenant_id and resource_id=p_resource_id) into v_has_bookings;
  if v_has_bookings then update public.resources set active=false,updated_at=now() where id=p_resource_id and tenant_id=v_tenant_id; return jsonb_build_object('action','archived'); end if;
  delete from public.resources where id=p_resource_id and tenant_id=v_tenant_id; return jsonb_build_object('action','deleted');
end; $$;

create or replace function public.owner_delete_asset(p_slug text, p_asset_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_tenant_id uuid;
begin
  select id into v_tenant_id from public.tenants where slug=p_slug;
  if v_tenant_id is null or not private.is_tenant_member(v_tenant_id, array['owner','manager']::public.member_role[]) then raise exception 'FORBIDDEN' using errcode='P0001'; end if;
  delete from public.tenant_assets where id=p_asset_id and tenant_id=v_tenant_id;
end; $$;

create or replace function public.owner_replace_hours(p_slug text, p_hours jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_tenant_id uuid; item jsonb;
begin
  select id into v_tenant_id from public.tenants where slug=p_slug;
  if v_tenant_id is null or not private.is_tenant_member(v_tenant_id, array['owner','manager']::public.member_role[]) then raise exception 'FORBIDDEN' using errcode='P0001'; end if;
  delete from public.working_hours where tenant_id=v_tenant_id;
  for item in select * from jsonb_array_elements(coalesce(p_hours,'[]'::jsonb)) loop
    if coalesce((item->>'active')::boolean,false) then
      insert into public.working_hours(tenant_id,weekday,start_time,end_time,active) values(v_tenant_id,(item->>'weekday')::smallint,(item->>'start_time')::time,(item->>'end_time')::time,true);
    end if;
  end loop;
end; $$;

revoke all on function public.owner_delete_service(text,uuid), public.owner_delete_resource(text,uuid), public.owner_delete_asset(text,uuid), public.owner_replace_hours(text,jsonb) from public,anon;
grant execute on function public.owner_delete_service(text,uuid), public.owner_delete_resource(text,uuid), public.owner_delete_asset(text,uuid), public.owner_replace_hours(text,jsonb) to authenticated;
