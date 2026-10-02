# Setup

Требования: Node.js 22+, npm 10+, Docker Desktop и Supabase CLI 2.x для локальной БД.

1. Выполните `npm ci`.
2. Создайте `.env` из `.env.example`.
3. Запустите `npx supabase start` и возьмите local API URL и publishable key из вывода.
4. Выполните `npx supabase db reset`; миграции и `supabase/seed.sql` применятся автоматически.
5. Запустите `npm run dev`.

Во frontend разрешены только `VITE_SUPABASE_URL` и publishable key. `SUPABASE_SERVICE_ROLE_KEY` нужен исключительно CLI `tenant:publish` и никогда не должен начинаться с `VITE_`.
