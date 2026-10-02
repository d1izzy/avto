# Deployment

Соберите `npm run build` и опубликуйте `dist/` в Cloudflare Pages. Добавьте SPA fallback `/* /index.html 200`, `VITE_SUPABASE_URL` и publishable key на этапе build. Добавьте домен в Supabase Auth URL Configuration.

Примените миграции через `supabase db push` из CI с production secrets. Не запускайте demo seed в production. Настройте Supabase Storage, database backups, log drain без PII, Cloudflare rate limiting и worker для `notification_jobs` только после подключения реального provider.

PWA не кеширует Supabase REST: операции booking всегда идут в сеть. Tenant images кешируются на неделю.
