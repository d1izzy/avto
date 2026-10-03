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

## Вход клиента по почте

Сейчас `VITE_CUSTOMER_EMAIL_LOGIN_ENABLED` выключен. Форма сообщает, что вход по почте пока недоступен, и не отправляет запросы. Гостевая запись и пароль владельца работают.

1. Подключить собственный SMTP в Authentication → Email → SMTP Settings проекта serviceslot. Стандартный отправитель Supabase не предназначен для писем произвольным клиентам.
2. В Authentication → URL Configuration установить Site URL и разрешить точный redirect `https://avto-d1izzys-projects.vercel.app/s/graphite/account` (добавить используемые алиасы отдельно).
3. Установить `VITE_CUSTOMER_EMAIL_LOGIN_ENABLED=true` в Vercel и пересобрать сайт.
4. Проверить письмо на своём тестовом адресе, переход по ссылке и появление сохранённой записи на втором устройстве.

Пароли SMTP и секретные ключи остаются на сервере Supabase; во frontend их не добавляют.
