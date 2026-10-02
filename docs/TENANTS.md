# Tenants

Source provisioning configuration лежит в `config/tenants/{slug}/business.json`; runtime source — Supabase. Команды:

```bash
npm run tenant:new -- my-service
npm run tenant:validate
npm run tenant:publish -- my-service
npm run tenant:verify -- my-service
```

Publish делает upsert только business settings и не удаляет bookings, customers, vehicles, memberships или загруженные assets. Перевод `preview` в `live` делайте после проверки адреса, графика, каталога, ресурсов и внешних интеграций.
