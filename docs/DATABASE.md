# Database

Миграции разделены на schema, transactional RPC и RLS/storage. Все tenant-зависимые строки содержат `tenant_id`. Составные FK `(entity_id, tenant_id)` запрещают cross-tenant связи.

`resource_occupancies` — источник истины занятости. GiST exclusion constraint на `(tenant_id, resource_id, tstzrange)` запрещает пересечение активных интервалов даже при конкурентных транзакциях. Booking snapshots сохраняют исторические имя услуги, цену, валюту и данные автомобиля.

Время записей хранится как `timestamptz` (UTC), рабочие часы — local `time`. RPC строит local interval в timezone tenant и PostgreSQL корректно применяет DST при `AT TIME ZONE`.

Проверка локально: `npx supabase db reset`, затем `npx supabase test db`.
