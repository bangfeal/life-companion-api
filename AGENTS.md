# AGENTS.md — Life Companion API

## Purpose

Build an independently deployable REST API for a personal life-companion application. It records and analyzes information across specialized life domains (initially goals, scheduling, sleep, and education), helps users pursue measurable goals, and eventually supports a hybrid recommendation system: deterministic, evidence-backed rules for conclusions and an LLM for interpretation and authorized actions.

The API must remain useful without an LLM and must serve multiple independent clients (e.g., Next.js web and React Native mobile) without coupling its contracts to a particular UI.

This document contains the implementation guide and the current verified repository status. Inspect the repository before making changes; adapt paths and commands to the actual project. Keep decisions reversible where possible.

## Current repository status — 2026-11-15

M1 is implemented and locally verified against real PostgreSQL. M2–M8 remain planned; authentication, domain tables, recommendations, and AI are not implemented.

- Runtime/tooling: Node.js 24, TypeScript ESM, Fastify, `typebox` (the package required by the installed Fastify type provider), Vitest, ESLint, and Prettier.
- `src/app.ts` exports `buildApp()`; `src/main.ts` handles configuration, logging, startup, and graceful shutdown. `/health` is process liveness and intentionally does not query PostgreSQL.
- `/openapi.json` serves OpenAPI 3.1; `npm run openapi:generate` refreshes the committed `openapi.json`. Do not edit that generated contract manually.
- PostgreSQL 17 is configured in Docker Compose; Drizzle/postgres.js handle database access and migrations. The baseline migration executes `SELECT 1` and establishes migration bookkeeping without introducing domain tables. Migrations run explicitly, outside HTTP startup.
- Verified locally: `npm run check` (type checking, lint, formatting, 12 HTTP/configuration tests, production build), compiled HTTP startup and shutdown, and OpenAPI generation. Clean PostgreSQL 17.11 databases passed `npm run db:migrate` twice and `npm run test:integration` (1 test).
- Docker Compose is now verified locally: the PostgreSQL 17 container is healthy on localhost:5432, the development database migration was applied by the user, and `life_companion_test` was created and passed the integration test. `npm run dev` started successfully and `/health` returned `{"status":"ok"}`. Earlier clean-database checks also used a temporary PostgreSQL 17.11 binary under `/tmp`. Hosted GitHub Actions execution remains unverified; CI is configured with PostgreSQL 17.
- Dependency review: `npm audit` reports zero vulnerabilities after overrides for `minimatch` and the legacy loader's `esbuild`. See `docs/decisions/0002-development-dependency-overrides.md` for rationale, compatibility checks, and removal criteria. Reassess overrides when updating their parent tools; do not use `npm audit fix --force` to downgrade the toolchain.

### Working commands and next task

- `npm ci`, then `npm run check` for ordinary changes.
- `npm run db:up`, then `npm run db:migrate` for the local development database (copy `.env.example` to `.env` first).
- `TEST_DATABASE_URL=<disposable PostgreSQL URL> npm run test:integration` explicitly applies migrations to the named test database; never point it at personal or production data. See README for creating the test database.
- Run `npm audit --audit-level=moderate` after dependency changes and regenerate OpenAPI after public contract changes.
- Next milestone: M2 identity and authorization. Choose/document authentication and deliver a small identity slice with application-level authorization tests. Introduce domain tables only with their owning milestone. Do not recreate the foundation or scaffold future modules.
- Full HTTP → application → persistence and cross-user isolation tests remain future work because no persisted HTTP capabilities or identity exist yet. The foundation's database test verifies migrations and SQL connectivity only.

## Agent operating instructions

1. **Inspect first.** Check the repository, package manager, existing conventions, tests, and docs before proposing or changing code. Do not overwrite an established working implementation to match this outline.
2. **Work incrementally.** Choose the smallest complete vertical slice for the current milestone. Before a substantial change, briefly explain the proposed files, contracts, migration, and tests.
3. **Prefer functioning code over speculative abstractions.** Add an interface or framework only when it protects a real boundary or makes testing materially easier.
4. **Preserve module boundaries.** Other modules must use a module's exported application services/contracts, not reach into its tables or repositories.
5. **Treat API compatibility as a feature.** Validate inputs and outputs; update OpenAPI contracts, tests, and documentation whenever public behavior changes.
6. **Prioritize security and user privacy.** Enforce authorization server-side, scope data access to the authenticated user, minimize retained personal information, and never put secrets or sensitive user data in logs.
7. **Do not fabricate scientific evidence.** Recommendation rules must have traceable sources, applicability limits, and testable behavior. Clearly label preliminary heuristics as such.
8. **Never let an LLM write directly to the database.** Expose explicit application operations; validate, authorize, and audit proposed actions. Changes to existing user data should require approval initially.
9. **Verify each slice.** Run applicable tests, linting, type checks, and migrations; report what passed, what failed, and what could not be run.
10. **Ask only when a choice is consequential and genuinely unresolved.** Otherwise make a reasonable, documented decision and proceed.

## Initial technology decisions

| Concern | Default choice |
|---|---|
| API language/runtime | TypeScript on an actively supported Node.js LTS version |
| HTTP server | Fastify |
| Validation and JSON Schema | TypeBox + Fastify type provider |
| Persistence | PostgreSQL |
| SQL and migrations | Drizzle ORM |
| API description | OpenAPI 3.1; document routes and generate client types later |
| Unit/integration tests | Vitest, Fastify `inject`, and PostgreSQL-backed integration tests |
| Logging | Pino with sensitive-field redaction |
| Local infrastructure | Docker Compose |
| AI integration (later) | Provider SDK behind an adapter; no orchestration framework by default |

Do not introduce microservices, event buses, MongoDB, vector databases, Redis, Kubernetes, or an elaborate agent framework without a demonstrated need. PostgreSQL `JSONB` is acceptable for genuinely variable secondary attributes; prefer typed relational columns and constraints for core domain data.

## Architectural shape

Start with a **modular monolith**: one deployable API process, one PostgreSQL database, and separate modules with clear ownership. Organize primarily by business capability, not by horizontal folders containing all controllers or all services.

Suggested structure (create as needed; empty placeholders are unnecessary):

```text
src/
  main.ts                        # startup only
  app.ts                         # app factory; usable in tests
  modules/
    identity/
    goals/
    habits/
    scheduling/
    sleep/
    education/
    analytics/
    recommendations/
    assistant/
  shared/
    errors/
    contracts/
    types/
  infrastructure/
    database/
    auth/
    logging/
    jobs/                        # only when needed

# Typical layout inside a mature module:
modules/sleep/
  domain/                        # concepts, invariants, deterministic calculations
  application/                   # use cases, authorization-sensitive operations
  infrastructure/                # tables and repository adapters
  http/                          # routes, schemas, transport mapping
  index.ts                       # public module exports

drizzle/migrations/
tests/integration/
tests/contract/
docs/architecture/
docs/decisions/
docker-compose.yml
```

**Dependency direction:** HTTP handlers call application operations; application operations use domain logic and injected infrastructure ports; infrastructure implements persistence/integration details. Keep business calculations free of Fastify and database dependencies. `analytics`, `recommendations`, and `assistant` consume published domain services, not another module's internal repositories.

Implement only the layers a module truly needs. Do not create generic base repositories or universal domain-plugin frameworks prematurely.

## Core concepts and domain strategy

- **Built-in specialized domains** (sleep, education, later exercise/nutrition/etc.) own domain-specific schemas, validation, calculations, and capabilities.
- **Shared capabilities** (identity, goals, habits, tasks, scheduling) can relate to multiple domains through explicit, validated relationships.
- Users can eventually customize goals, habits, preferences, and optional metrics *within* specialized domains. Do **not** equate extensibility with a completely user-defined, schema-less domain model.
- A new domain should normally be addable through a module, migration, service registration, endpoints, and tests without changing unrelated domain implementations.
- Preserve the distinction between **observed/user-reported facts**, **derived metrics**, **rules/recommendations**, and **LLM explanations**.

## Public HTTP API conventions

- Base prefix: `/api/v1` (health check may be unversioned: `GET /health`).
- Design **resource- and capability-oriented** endpoints, not endpoints tied to UI widgets or pages.
- Use domain-specific schemas (`POST /sleep/sessions`), not a universal `POST /data` with unvalidated arbitrary attributes.
- Use UUID identifiers; do not use client-supplied user IDs as authorization authority.
- Store instants consistently (UTC); preserve relevant IANA time zones for calendar/sleep semantics. Distinguish a date from an instant.
- Validate query, path, body, and responses; use consistent errors (prefer RFC 9457 Problem Details), documented filtering and pagination, and `PATCH` for partial updates.
- Avoid exposing database rows/ORM types as public response DTOs.
- Keep backward-compatible changes within v1; document breaking changes and version intentionally when required.
- Use OpenAPI as the public contract. Generated clients may live in frontend repos; frontends must not import server implementation code.
- Require authentication and resource-level ownership checks for private resources. Rate-limit sensitive endpoints and make mutating operations retry-safe where relevant.

### Candidate endpoints, not an upfront implementation mandate

```http
GET    /health
GET    /api/v1/me
POST   /api/v1/goals
GET    /api/v1/goals
GET    /api/v1/goals/:id
PATCH  /api/v1/goals/:id
DELETE /api/v1/goals/:id

GET    /api/v1/habits
POST   /api/v1/habits
POST   /api/v1/habits/:id/logs
GET    /api/v1/schedule/events
POST   /api/v1/schedule/events
GET    /api/v1/sleep/sessions
POST   /api/v1/sleep/sessions
GET    /api/v1/sleep/summary
GET    /api/v1/study/sessions
POST   /api/v1/study/sessions
GET    /api/v1/recommendations
POST   /api/v1/assistant/messages
POST   /api/v1/action-proposals
GET    /api/v1/action-proposals/:id
POST   /api/v1/action-proposals/:id/approve
POST   /api/v1/action-proposals/:id/reject
```

Add per-resource edit/delete endpoints only when needed. For collections, support bounded pagination and useful date filters. Document request/response examples and errors.

## Database guidance

Introduce tables with their milestones, not all at once. Initial candidates:

```text
users, user_profiles
goals, goal_domains
habits, habit_logs
tasks, schedule_events
sleep_sessions
study_sessions, examinations
```

Later candidates:

```text
research_sources, recommendation_rules, recommendations, recommendation_feedback
agent_action_proposals, agent_action_executions
```

- Enforce foreign keys, uniqueness, ownership, timestamps, and relevant check constraints.
- Use explicit sleep start/end timestamps and domain-specific study fields instead of burying core facts in JSONB.
- Record provenance (manual entry vs imported vs computed), units, and timestamps where relevant.
- All schema changes go through versioned migrations; test clean-database setup and migration execution.
- Explicitly design deletion, retention, export, and backups before storing substantial personal data.

## Hybrid intelligence design (later milestones)

Pipeline:

```text
Domain data -> deterministic analytics -> evidence-backed rules
            -> structured recommendation -> LLM explanation
            -> optional typed action proposal -> approval -> application service
```

Rules should return structured, testable outputs: rule ID/version, observations, recommendation code, priority, and research-source IDs. The LLM may explain and contextualize the output but must not invent evidence, silently change numerical analysis, or imply correlation proves causation.

Research references should track source metadata, claims, limitations, and applicability. Start with a few reviewed rules; do not present arbitrary thresholds as scientifically validated.

The assistant uses a curated tool registry (e.g., `getSchedule`, `getSleepSummary`, `getStudyTasks`, `proposeSchedule`, `createTask`). Tool inputs/outputs must be validated. Use the authenticated user context, never an LLM-supplied identity. For writes, generate typed, auditable, expiring action proposals; initially require user approval before executing. Check authorization and current-state conflicts again at execution, and use safe retry/idempotency behavior.

Do not make core business operations dependent on LLM availability.

## Milestones and completion criteria

### M1 — Repository and API foundation

- Initialize TypeScript, Fastify, validation, PostgreSQL/Drizzle, Docker Compose, configuration, lint/format, Vitest, CI, logging, and predictable error handling.
- Create testable `buildApp()` separate from process startup.
- Add `GET /health`, OpenAPI generation, and migration commands.
- **Done when:** the API starts locally; migrations apply to a clean PostgreSQL instance; health, type-check, and tests pass.

### M2 — Identity and authorization

- Choose and document session/token authentication; add registration/login/logout as appropriate, `/api/v1/me`, and user profiles.
- Enforce user-level authorization in application operations; test cross-user isolation.
- **Done when:** authenticated users cannot access or change each other's private resources.

### M3 — Shared life-management capabilities

- Implement goals first, then habits/logs, tasks, and scheduled events as required.
- Add goal/domain associations, consistent timestamps, validation, and pagination.
- **Done when:** these operations work end to end through HTTP, domain services, migrations, and integration tests.

### M4 — Sleep: first specialized domain

- Add sleep session recording, edits, history, summary, and deterministic duration/consistency calculations.
- Cover invalid and timezone-sensitive cases with tests.
- **Done when:** sleep has meaningful domain-specific behavior beyond generic CRUD.

### M5 — Education and cross-domain integration

- Add study sessions, examinations, and progress summaries; connect study tasks to scheduling.
- Access sleep and education summaries through their public application APIs, not internal SQL in other modules.
- **Done when:** one useful cross-domain query/use case works without coupling implementations.

### M6 — Deterministic recommendations

- Add an evidence-source catalog, typed rules, rule versioning, recommendation persistence, and feedback.
- **Done when:** recommendations are reproducible and explainable without calling an LLM.

### M7 — LLM assistant and approved actions

- Add provider adapter, read-only tools, assistant endpoint, structured action proposals, approval/rejection, execution, and audit records.
- **Done when:** the assistant explains user data, proposes a change, and an approved action executes through normal services with authorization and conflict checks.

### M8 — Hardening and independent consumers

- Generate an OpenAPI-based client, test a minimal independent consumer, add contract/security tests, user export/deletion, and module-extension documentation.
- **Done when:** a separate frontend can use the API without accessing internal code or the database.

## FIRST TASK for an agent entering a new repository

1. Inspect repository contents and report which parts of M1 (if any) already exist.
2. Propose the smallest initial change set for M1, with exact files and commands.
3. Implement a minimal app factory, health route, test, and local database setup **only when relevant to the current state**.
4. Run checks; summarize results, unresolved decisions, and the next smallest task.
5. Avoid creating the complete future module tree or implementing AI, recommendations, and domain modules in the first change.

## Architecture acceptance criteria

Before calling the foundation stable, verify:

- [ ] A new domain can be added without modifying unrelated domain internals.
- [ ] Domain calculations can be tested without running HTTP or PostgreSQL.
- [ ] Independent clients use OpenAPI contracts, not server implementation imports.
- [x] Core API behavior works without AI services.
- [ ] Rule outputs are deterministic and unit-testable.
- [ ] Sensitive operations enforce ownership at the application boundary.
- [x] Migrations work on a clean database.
- [ ] Integration tests cover HTTP -> application -> persistence.
- [ ] Agent actions can be audited, rejected, and safely retried.
- [ ] Tests show users cannot access each other's records.

## Decision records

Record significant choices briefly under `docs/decisions/`, starting with:

- `0001-modular-monolith.md`
- `0002-postgresql.md`
- `0003-rest-and-openapi.md`
- `0004-domain-module-boundaries.md`
- `0005-hybrid-recommendation-engine.md`

For each: context, decision, alternatives, consequences, and when to revisit it. These are suggested future files, not prerequisites for the first commit.
