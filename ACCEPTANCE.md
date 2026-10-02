# Acceptance

- TypeScript strict — PASS
- ESLint — PASS
- Tenant config validation (2 tenants) — PASS
- Unit tests — PASS (3 tests)
- Production PWA build — PASS
- npm audit — PASS (0 vulnerabilities)
- Database migrations apply — PASS (remote project `mzaghgnxetlrbcpvdvzq`)
- Seed — PASS (2 tenants, 5 services, 4 resources, 12 working-hour rows)
- Tenant isolation / RLS SQL assertions — NOT VERIFIED
- Concurrent booking exclusion — IMPLEMENTED, NOT VERIFIED with two concurrent remote clients
- Idempotency — PASS (remote smoke test returned one row for repeated key)
- Cancel and occupancy release — IMPLEMENTED, NOT VERIFIED against PostgreSQL
- Atomic reschedule rollback — IMPLEMENTED, NOT VERIFIED against PostgreSQL
- Historical price/service snapshots — IMPLEMENTED
- Timezone/DST calculation — IMPLEMENTED, NOT VERIFIED against PostgreSQL
- Owner authentication and membership — PASS (remote sign-in and owner RPC)
- Public tenant and availability RPC — PASS (remote smoke test)
- Public access token hash — IMPLEMENTED, NOT VERIFIED against PostgreSQL
- Notification outbox deduplication — IMPLEMENTED, external delivery NOT CONFIGURED
- Playwright customer flow — CREATED, NOT VERIFIED without seeded Supabase
- Real email/SMS/push — NOT CONFIGURED
- Production deployment — NOT VERIFIED
- AI/LLM features — ABSENT

Этот файл обновляется только по фактически выполненным проверкам.
