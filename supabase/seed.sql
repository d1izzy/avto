-- Demo credentials: owner@graphite.demo / ChangeMe123! (local development only)
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('00000000-0000-0000-0000-000000000000','90000000-0000-0000-0000-000000000001','authenticated','authenticated','owner@graphite.demo',crypt('ChangeMe123!',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"demo":true}',now(),now()) on conflict(id) do nothing;
insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
values('91000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','owner@graphite.demo','{"sub":"90000000-0000-0000-0000-000000000001","email":"owner@graphite.demo","email_verified":true}','email',now(),now(),now()) on conflict(provider_id,provider) do nothing;

insert into public.tenants(id,slug,name,description,phone,email,address,timezone,currency,accent_color,status,hero_url) values
('10000000-0000-0000-0000-000000000001','graphite','GRAPHITE Detailing','Точная работа с кузовом и салоном. Детейлинг без спешки, с понятным результатом.','+7 343 000-11-22','hello@graphite.demo','Екатеринбург, ул. Машинная, 42','Asia/Yekaterinburg','RUB','#D7FF3F','preview','https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?auto=format&fit=crop&w=1800&q=85'),
('10000000-0000-0000-0000-000000000002','nova-garage','NOVA Garage','Современный городской автосервис: диагностика, обслуживание и честные сроки.','+7 495 000-33-44','service@nova.demo','Москва, 2-й Силикатный проезд, 9','Europe/Moscow','RUB','#5BE7C4','preview','https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=1800&q=85') on conflict(id) do update set name=excluded.name,description=excluded.description,hero_url=excluded.hero_url;
insert into public.tenant_settings(tenant_id,minimum_booking_notice_minutes,maximum_booking_days,cancellation_deadline_minutes) values
('10000000-0000-0000-0000-000000000001',60,60,1440),('10000000-0000-0000-0000-000000000002',120,45,720) on conflict(tenant_id) do nothing;
insert into public.tenant_memberships(tenant_id,user_id,role) values('10000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','owner') on conflict do nothing;

insert into public.services(id,tenant_id,name,description,price,currency,duration_minutes,buffer_after_minutes,sort_order) values
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Комплексный детейлинг','Глубокая очистка салона и бережная мойка кузова.',18500,'RUB',240,30,1),
('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Полировка кузова','Восстановительная полировка и защитный состав.',32000,'RUB',480,30,2),
('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Химчистка салона','Деликатная очистка всех поверхностей салона.',14000,'RUB',300,30,3),
('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','Компьютерная диагностика','Полная диагностика электронных систем.',3500,'RUB',60,15,1),
('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000002','Плановое ТО','Замена масла, фильтров и контроль ключевых узлов.',8900,'RUB',120,15,2) on conflict(id) do nothing;
insert into public.resources(id,tenant_id,name,type,description,sort_order) values
('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Детейлинг-бокс №1','detailing','Закрытый бокс с контролируемым светом',1),
('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Детейлинг-бокс №2','detailing','Универсальный пост',2),
('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','Пост диагностики','diagnostic','Диагностический пост',1),
('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','Подъёмник №1','lift','Двухстоечный подъёмник',2) on conflict(id) do nothing;
insert into public.service_resources(tenant_id,service_id,resource_id) values
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000002'),
('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000003'),
('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000005','30000000-0000-0000-0000-000000000004') on conflict do nothing;
insert into public.working_hours(tenant_id,weekday,start_time,end_time) select t.id,d,'09:00','20:00' from public.tenants t cross join generate_series(1,6) d where t.id in ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002') on conflict do nothing;
insert into public.schedule_exceptions(tenant_id,date,type,reason) values('10000000-0000-0000-0000-000000000001',current_date+14,'closed','Демо: технический день') on conflict do nothing;

insert into public.customers(id,tenant_id,name,phone,email) values('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Демо Клиент','+7 900 000-00-01','demo@example.com') on conflict(id) do nothing;
insert into public.vehicles(id,tenant_id,customer_id,brand,model,year,license_plate) values('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','BMW','M4',2023,'А001АА196') on conflict(id) do nothing;
