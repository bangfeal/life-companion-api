# Life Companion API

Independent REST API foundation. Requires Node.js 24 and npm; database tasks also require PostgreSQL 17 (Docker Compose recommended).

## Local development

```sh
npm ci
cp .env.example .env
npm run db:up
npm run db:migrate
npm run dev
```

`GET http://127.0.0.1:3000/health` returns `{"status":"ok"}`. It is process liveness, not database readiness. `GET /openapi.json` serves OpenAPI 3.1. The HTTP foundation can run without PostgreSQL; database commands require `DATABASE_URL`. Configuration errors fail startup. `.env` is local and ignored; the example credentials are for local development only.

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

Tests apply migrations and verify repeat execution. CI runs them against a fresh PostgreSQL service. `npm run db:down` stops the database while preserving its named volume. No domain records or authentication exist yet.

## Project layout

- `src/app.ts`: app factory, health and contract routes, error handling.
- `src/main.ts`: configuration, logging, listening, shutdown.
- `src/infrastructure/database`: database adapter and migration runner.
- `tests`: HTTP/configuration tests and explicit PostgreSQL integration tests.
- `docs/decisions`: architecture decisions.

Next milestone: identity and authorization. New domain modules should own persistence and publish application operations; business calculations should remain independent of HTTP and SQL.

## Verification status

On 2026-11-15, clean PostgreSQL 17.11 databases passed the migration CLI twice and the integration test. Initial verification used a temporary native PostgreSQL instance. Docker Compose was subsequently verified locally: the PostgreSQL container is healthy, the integration test passed against `life_companion_test`, and the development API returned a successful health response. Hosted CI execution remains unverified. The baseline remains intentionally free of domain tables.

`npm audit` reports zero vulnerabilities after patched development-dependency overrides. See [the dependency decision](docs/decisions/0002-development-dependency-overrides.md) for rationale and removal criteria. CI audits development and production dependencies with `npm audit --audit-level=moderate`.
