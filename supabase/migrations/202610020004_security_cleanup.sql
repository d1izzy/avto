create policy rate_limits_no_client_access on public.rate_limits
  for all to anon, authenticated
  using (false)
  with check (false);

alter extension btree_gist set schema extensions;
