# Life Companion API

Independent REST API with identity, revocable bearer sessions, goals, daily habits/logs, tasks, and scheduled events. Requires Node.js 24 and npm; database tasks also require PostgreSQL 17 (Docker Compose recommended).

## Local development

```sh
npm ci
cp .env.example .env
npm run db:up
npm run db:migrate
npm run dev
```

`GET http://127.0.0.1:3000/health` returns `{"status":"ok"}`. It is process liveness, not database readiness. `GET /openapi.json` serves OpenAPI 3.1. The app factory and OpenAPI export can run without PostgreSQL; the server entry point and database commands require `DATABASE_URL`. Identity operations require a live database and applied migrations. Configuration errors fail startup. `.env` is local and ignored; the example credentials are for local development only.

```sh
npm run check
npm run openapi:generate
npm run build
npm start
```

`HOST`, `PORT`, and `LOG_LEVEL` configure the process. Business endpoints will use `/api/v1`. Unknown routes and request failures return sanitized `application/problem+json` responses. Request bodies, URLs, and exception contents are not logged by the foundation.

## Database and migrations

The initial baseline migration runs `SELECT 1` and establishes Drizzle migration bookkeeping without creating domain tables. Add tables with their owning modules, generate migrations with `npm run db:generate`, review and commit the SQL and metadata, then run `npm run db:migrate`. Migrations are deployment commands, not server startup side effects. The migration command also works after build via `node dist/infrastructure/database/migrate.js` from the repository root; keep the `drizzle` directory in deployment artifacts.

For integration tests, create a separate disposable database:

```sh
docker compose exec postgres createdb -U companion life_companion_test
TEST_DATABASE_URL=postgres://companion:companion@localhost:5432/life_companion_test npm run test:integration
```

Tests apply migrations and verify repeat execution. CI runs them against a fresh PostgreSQL service. `npm run db:down` stops the database while preserving its named volume. Identity and shared life-management tables are implemented. Sleep, education, recommendations, and AI remain future milestones.

## Project layout

- `src/app.ts`: app factory, health and contract routes, error handling.
- `src/main.ts`: configuration, logging, listening, shutdown.
- `src/infrastructure/database`: database adapter and migration runner.
- `src/modules/identity`: public identity services, application authorization, domain validation, HTTP routes, and owned persistence.
- `tests`: HTTP/configuration tests and explicit PostgreSQL integration tests.
- `docs/decisions`: architecture decisions.

M2 identity and authorization is implemented. See [the identity API guide](docs/identity-api.md) for endpoints, curl examples, and limitations, and [the authentication decision](docs/decisions/0003-identity-and-sessions.md) for session and password design. M3 shared life capabilities are now implemented; see [the life-management API guide](docs/life-management-api.md). Next milestone: sleep recording and deterministic summaries. New domain modules should own persistence and publish application operations; business calculations should remain independent of HTTP and SQL.

## Verification status

On 2026-11-15, clean PostgreSQL 17.11 databases passed the migration CLI twice and the integration test. Initial verification used a temporary native PostgreSQL instance. Docker Compose was subsequently verified locally: the PostgreSQL container is healthy, the integration test passed against `life_companion_test`, and the development API returned a successful health response. Hosted CI execution remains unverified. The baseline remains intentionally free of domain tables.

`npm audit` reports zero vulnerabilities after patched development-dependency overrides. See [the dependency decision](docs/decisions/0002-development-dependency-overrides.md) for rationale and removal criteria. CI audits development and production dependencies with `npm audit --audit-level=moderate`.

## M2 verification — 2026-11-27

Registration/login issue opaque seven-day bearer sessions, logout revokes the presented session, and GET/PATCH `/api/v1/me` authorize private profile access inside application operations. Passwords use salted scrypt; only token hashes are stored. The new migration creates users, profiles, and sessions with constraints and ownership foreign keys. Identity endpoints are rate-limited and use no-store responses. Read the API guide before integrating a client; no cookies, refresh tokens, email verification, account recovery, or MFA are provided.

18 unit/HTTP tests and 10 PostgreSQL integration tests pass, including cross-user isolation, invalid/expired/revoked credentials, concurrent duplicate registration, profile validation, and authentication rate limiting. Migration setup uses a fresh isolated PostgreSQL 17 container and serial integration test files. The development database is not automatically migrated by this change: run `npm run db:up` and `npm run db:migrate` before starting the updated server.

## M3 shared capabilities — 2026-11-27

Goals support measurable manually reported progress and sleep/education domain associations. Daily habits support retry-safe completion logs by local date. Tasks can link to owned goals, and timed calendar events can link to owned tasks. Each capability supports private create/list/read/patch/delete operations, bounded pagination, validation, and documented filters. This does not implement the sleep or education domains.

The composition root `src/life-management.ts` connects public module services. Authorization remains inside each application operation. Cross-module ownership foreign keys and update triggers are explicit SQL contracts in `0003_ownership.sql`; preserve these when changing migrations, and do not bypass migrations with schema-push commands. Deleting linked goals/tasks detaches references while preserving independent records; deleting habits cascades their logs.

See [the M3 decision](docs/decisions/0004-shared-life-capabilities.md) for model limits, module boundaries, pagination, retries, and retention. Apply pending migrations before starting the updated API. Verification uses isolated databases and does not migrate the user's development database.
