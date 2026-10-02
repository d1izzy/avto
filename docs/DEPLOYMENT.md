# Vercel

Проект avto связан с приватным репозиторием d1izzy/avto и Vercel d1izzys-projects/avto.

Основной адрес: https://avto-d1izzys-projects.vercel.app/s/graphite
Кабинет: https://avto-d1izzys-projects.vercel.app/s/graphite/owner

- Build: npm run build
- Output: dist
- Переменные на этапе сборки: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY.
- SUPABASE_SERVICE_ROLE_KEY не добавляется во frontend.
- vercel.json содержит SPA fallback для прямого открытия вложенных страниц.
- После публикации проверьте создание и отмену тестовой заявки и вход владельца.
- Для E2E: E2E_SUPABASE_READY=1; для кабинета дополнительно E2E_OWNER_EMAIL и E2E_OWNER_PASSWORD. BASE_URL переключает тесты на опубликованный сайт.

PWA не кеширует Supabase REST: заявки всегда идут в сеть. Изображения кешируются на неделю.
Существующая удалённая база сохраняется при обновлении frontend. Demo seed повторно не запускается.
