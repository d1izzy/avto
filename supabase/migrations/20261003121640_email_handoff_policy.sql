create policy email_login_handoffs_no_client_access
on email_auth_private.email_login_handoffs
for all to anon, authenticated
using (false) with check (false);
