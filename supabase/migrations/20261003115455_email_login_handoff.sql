-- A short-lived mailbox for PKCE authorization codes, never sessions or email
-- addresses. Knowing the 256-bit channel alone cannot authenticate: GoTrue also
-- requires the verifier held only by the app that requested the email.
create schema email_auth_private;
revoke all on schema email_auth_private from public;
create table email_auth_private.email_login_handoffs (
  channel_hash text primary key,
  auth_code text,
  flow_id text check (flow_id ~ '^[a-f0-9]{32}$'),
  expires_at timestamptz not null default now() + interval '1 hour',
  delivered_at timestamptz,
  check (length(auth_code) <= 128)
);
create index email_login_handoffs_expiry_idx on email_auth_private.email_login_handoffs(expires_at);
alter table email_auth_private.email_login_handoffs enable row level security;
revoke all on email_auth_private.email_login_handoffs from public, anon, authenticated;

create function email_auth_private.email_login_handoff(p_channel text, p_action text, p_code text, p_flow_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_hash text;
  v_row email_auth_private.email_login_handoffs;
  v_ip text;
  v_count integer;
begin
  if p_channel is null or p_channel !~ '^[a-f0-9]{64}$' then
    raise exception 'INVALID_CHANNEL';
  end if;
  v_hash := encode(extensions.digest(p_channel, 'sha256'), 'hex');
  if p_action = 'start' then
    -- Limit creation, not polling. No IP or email is stored in the mailbox.
    v_ip := encode(extensions.digest(coalesce(nullif(current_setting('request.headers', true), '')::jsonb->>'x-forwarded-for', 'unknown'), 'sha256'), 'hex');
    insert into public.rate_limits(bucket, key_hash, window_start, request_count)
      values ('email_handoff', v_ip, date_trunc('hour', now()), 1)
      on conflict (bucket, key_hash, window_start) do update
      set request_count = public.rate_limits.request_count + 1 returning request_count into v_count;
    if v_count > 30 then return jsonb_build_object('status', 'limited'); end if;
    delete from public.rate_limits where bucket = 'email_handoff' and window_start < now() - interval '2 hours';
    delete from email_auth_private.email_login_handoffs where expires_at < now();
    insert into email_auth_private.email_login_handoffs(channel_hash) values (v_hash) on conflict do nothing;
    return jsonb_build_object('status', 'waiting');
  end if;
  select * into v_row from email_auth_private.email_login_handoffs where channel_hash = v_hash for update;
  if not found or v_row.expires_at <= now() then return jsonb_build_object('status', 'expired'); end if;
  if p_action = 'deliver' then
    if p_code is null or p_code !~ '^[a-zA-Z0-9_-]{20,128}$' or p_flow_id is null or p_flow_id !~ '^[a-f0-9]{32}$' then raise exception 'INVALID_CODE'; end if;
    -- Repeated callbacks are idempotent; cannot replace a code or extend its TTL.
    if v_row.auth_code is null then
      update email_auth_private.email_login_handoffs set auth_code = p_code, flow_id = p_flow_id,
        delivered_at = now(), expires_at = least(expires_at, now() + interval '5 minutes') where channel_hash = v_hash;
    elsif v_row.auth_code <> p_code or v_row.flow_id <> p_flow_id then
      raise exception 'CHANNEL_ALREADY_USED';
    end if;
    return jsonb_build_object('status', 'ready');
  elsif p_action = 'read' then
    if v_row.auth_code is null then return jsonb_build_object('status', 'waiting'); end if;
    return jsonb_build_object('status', 'ready', 'code', v_row.auth_code, 'flow_id', v_row.flow_id);
  elsif p_action = 'finish' then
    if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
    delete from email_auth_private.email_login_handoffs where channel_hash = v_hash;
    return jsonb_build_object('status', 'expired');
  end if;
  raise exception 'INVALID_ACTION';
end; $$;

-- Pre-authentication mailbox operations use an unguessable capability. They do
-- not inspect users, grant membership, or mint sessions. Only cleanup needs uid.
revoke all on function email_auth_private.email_login_handoff(text,text,text,text) from public;
grant usage on schema email_auth_private to anon, authenticated;
grant execute on function email_auth_private.email_login_handoff(text,text,text,text) to anon, authenticated;
create function public.email_login_handoff(p_channel text, p_action text, p_code text default null, p_flow_id text default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select email_auth_private.email_login_handoff(p_channel, p_action, p_code, p_flow_id);
$$;
revoke all on function public.email_login_handoff(text,text,text,text) from public;
grant execute on function public.email_login_handoff(text,text,text,text) to anon, authenticated;
