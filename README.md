# ServiceSlot

Мультитенантная PWA-платформа онлайн-записи для автосервисов и детейлинг-студий. Один статический React build обслуживает все businesses по маршруту `/s/:tenantSlug`; рабочие данные и правила доступа находятся в Supabase.

## Быстрый старт

```bash
npm ci
copy .env.example .env
npx supabase start
npx supabase db reset
npm run dev
```

Откройте `http://localhost:5173/s/graphite`. Demo owner: `owner@graphite.demo` / `ChangeMe123!` только для локального seed. Удалите или смените эти credentials перед общедоступным деплоем.

Основные команды: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`, `npm run tenant:validate`.

Документация: [SETUP](docs/SETUP.md), [архитектура](docs/ARCHITECTURE.md), [БД](docs/DATABASE.md), [безопасность](docs/SECURITY.md), [booking](docs/BOOKING.md), [tenants](docs/TENANTS.md), [deploy](docs/DEPLOYMENT.md), [запуск за 6 минут](docs/CLONE-IN-6-MINUTES.md), [acceptance](ACCEPTANCE.md).

Проект не содержит AI/LLM-функций. Email, SMS и push не считаются подключёнными: реализован только transactional outbox.
