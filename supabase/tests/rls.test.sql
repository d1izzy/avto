begin;
select plan(3);
select policies_are('public','bookings',array['bookings_member_all'],'bookings has tenant policy');
select policies_are('public','customers',array['customers_member_select'],'customers are private');
select policies_are('public','tenant_memberships',array['memberships_self_select'],'memberships are self-visible');
select * from finish(); rollback;
