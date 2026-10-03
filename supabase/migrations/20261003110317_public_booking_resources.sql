-- Extend the existing intentionally public catalog; do not grant access to resource tables.
-- Only active boxes linked to an active service of the same visible tenant are published.
create or replace function public.get_public_tenant(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'tenant', to_jsonb(t), 'settings', to_jsonb(s),
    'services', coalesce((select jsonb_agg(to_jsonb(x) order by x.sort_order, x.id) from public.services x where x.tenant_id=t.id and x.active and x.deleted_at is null), '[]'::jsonb),
    'resources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'name', r.name, 'description', r.description,
        'service_ids', links.service_ids
      ) order by r.sort_order, r.name, r.id)
      from public.resources r
      cross join lateral (
        select jsonb_agg(sr.service_id order by svc.sort_order, svc.id) as service_ids
        from public.service_resources sr
        join public.services svc on svc.id=sr.service_id and svc.tenant_id=sr.tenant_id
        where sr.resource_id=r.id and sr.tenant_id=t.id
          and svc.active and svc.deleted_at is null
      ) links
      where r.tenant_id=t.id and r.active and r.deleted_at is null and links.service_ids is not null
    ), '[]'::jsonb),
    'hours', coalesce((select jsonb_agg(to_jsonb(h) - 'id' - 'tenant_id' order by h.weekday,h.start_time) from public.working_hours h where h.tenant_id=t.id), '[]'::jsonb),
    'assets', coalesce((select jsonb_agg(to_jsonb(a) - 'id' - 'tenant_id' - 'storage_path' order by a.sort_order) from public.tenant_assets a where a.tenant_id=t.id), '[]'::jsonb)
  ) from public.tenants t join public.tenant_settings s on s.tenant_id=t.id where t.slug=p_slug and t.status in ('preview','live');
$$;
revoke all on function public.get_public_tenant(text) from public;
grant execute on function public.get_public_tenant(text) to anon, authenticated;
