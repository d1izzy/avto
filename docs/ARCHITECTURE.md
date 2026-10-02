# Architecture

Frontend является статической React 19 PWA. `TenantProvider` разрешает slug через `get_public_tenant`, после чего UI работает с UUID, возвращёнными БД. TanStack Query управляет серверным состоянием; Zod проверяет формы; owner-разделы загружаются лениво.

Критическая бизнес-логика находится в PostgreSQL RPC: availability, создание, отмена и перенос. Публичные RPC имеют узкие сигнатуры, отзывают default `PUBLIC EXECUTE` и не принимают tenant ID, цену, длительность или конечное время как доверенный input. Owner CRUD проходит через Supabase Auth, membership и RLS.

Границы кода: `src/features` содержит API и доменную логику; `src/pages` — маршруты; `src/layouts` — оболочки; `src/components/ui` — shadcn-подобные primitives; `supabase/migrations` — schema/functions/RLS; `scripts` — tenant pipeline.
