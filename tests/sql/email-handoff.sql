-- Run against the migrated database. All fixture mutations roll back.
begin;
set local role anon;
do $$
declare v jsonb; channel text := repeat('a',64);
begin
  if has_table_privilege('anon', 'email_auth_private.email_login_handoffs', 'SELECT') then raise exception 'mailbox exposed'; end if;
  if has_table_privilege('authenticated', 'email_auth_private.email_login_handoffs', 'SELECT') then raise exception 'mailbox exposed to signed-in users'; end if;
  if public.email_login_handoff(repeat('b',64), 'read')->>'status' <> 'expired' then raise exception 'unknown channel readable'; end if;
  v := public.email_login_handoff(channel, 'start');
  if v->>'status' <> 'waiting' then raise exception 'start failed'; end if;
  if public.email_login_handoff(channel, 'read')->>'status' <> 'waiting' then raise exception 'false success'; end if;
  v := public.email_login_handoff(channel, 'deliver', '12345678-1234-1234-1234-123456789abc', repeat('c',32));
  if v->>'status' <> 'ready' then raise exception 'delivery failed'; end if;
  v := public.email_login_handoff(channel, 'deliver', '12345678-1234-1234-1234-123456789abc', repeat('c',32));
  if v->>'status' <> 'ready' then raise exception 'duplicate delivery failed'; end if;
  begin
    perform public.email_login_handoff(channel, 'deliver', '12345678-1234-1234-1234-123456789def', repeat('c',32));
    raise exception 'replacement allowed';
  exception when raise_exception then if sqlerrm <> 'CHANNEL_ALREADY_USED' then raise; end if; end;
  v := public.email_login_handoff(channel, 'read');
  if v->>'flow_id' <> repeat('c',32) or v->>'code' <> '12345678-1234-1234-1234-123456789abc' then raise exception 'wrong delivery'; end if;
  begin
    perform public.email_login_handoff(channel, 'finish'); raise exception 'anonymous cleanup allowed';
  exception when raise_exception then if sqlerrm <> 'AUTH_REQUIRED' then raise; end if; end;
  begin
    perform public.email_login_handoff('invalid', 'start'); raise exception 'weak channel accepted';
  exception when raise_exception then if sqlerrm <> 'INVALID_CHANNEL' then raise; end if; end;
end $$;
reset role;
update email_auth_private.email_login_handoffs set expires_at = now() - interval '1 second'
where channel_hash = encode(extensions.digest(repeat('a',64), 'sha256'), 'hex');
set local role anon;
do $$ begin
  if public.email_login_handoff(repeat('a',64), 'read')->>'status' <> 'expired' then raise exception 'expired code readable'; end if;
  if public.email_login_handoff(repeat('a',64), 'deliver', '12345678-1234-1234-1234-123456789abc', repeat('c',32))->>'status' <> 'expired' then raise exception 'expired code revived'; end if;
end $$;
rollback;
select 'Mailbox permissions, isolation, idempotency and expiry: passed; fixtures rolled back' as result;
