# Security

RLS включён на каждой таблице exposed schema. Anon не имеет прямого доступа к персональным таблицам; публичные данные выдаются минимальными RPC. Authenticated user видит строки только tenants, где существует `tenant_memberships`.

Access token выводится из криптографически случайного UUID idempotency key через SHA-256; в БД хранится только SHA-256 hash итогового token. Это позволяет безопасно вернуть тот же token при network retry, не сохраняя raw value. Public RPC не логируют token или PII.

Service role запрещён во frontend. Storage paths начинаются с tenant UUID; policies проверяют membership. Перед production: сменить demo password, проверить Auth URL allowlist, включить leaked-password protection, ограничить JWT lifetime по риску, запустить Supabase database advisors и настроить WAF/rate limiting на Edge/Cloudflare.

PostgreSQL rate-limit table подготовлена, но распределённое ограничение запросов не включено: для production публичные RPC следует дополнительно закрыть Cloudflare rate limiting или Edge Function gateway.
