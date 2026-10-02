# Clone in 6 minutes

1. `git clone <repo> && cd avto`
2. `npm ci`
3. Создайте Supabase project или выполните `npx supabase start` для local Docker.
4. Скопируйте `.env.example` в `.env`, заполните URL и publishable key.
5. `npx supabase db reset` локально или `npx supabase link && npx supabase db push` для remote.
6. `npm run dev` и откройте `/s/graphite`.
7. `npm run tenant:new -- my-service`, заполните JSON и выполните `npm run tenant:validate`.
8. Для remote задайте `SUPABASE_SERVICE_ROLE_KEY` только в shell/CI и выполните `npm run tenant:publish -- my-service`, затем `npm run tenant:verify -- my-service`.

Перед live удалите demo account/data, добавьте owner через Supabase Auth и membership, а status переключите с `preview` на `live`.
