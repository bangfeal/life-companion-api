# API foundation

## Context

The repository needs a testable, independently deployable API before private domain data is introduced.

## Decision

Use a modular monolith on Node.js 24, TypeScript ESM, Fastify and TypeBox. Publish OpenAPI 3.1 at `/openapi.json` and commit the generated contract. Use PostgreSQL 17 with Drizzle and postgres.js. Keep migrations explicit, outside server startup. Use a no-op SQL baseline to verify migration bookkeeping without inventing domain tables. `/health` reports process liveness only and works without PostgreSQL. Database configuration is required only for database commands until a persisted capability exists.

Disable automatic request logging to avoid retaining URLs and personal data. Log request failures by request ID without exception contents; redact common secret fields. Return sanitized Problem Details. Authentication and domain authorization belong to M2.

## Alternatives

CommonJS, database-dependent liveness, premature user tables, and automatic startup migrations add coupling or premature decisions. Microservices add deployment complexity without a current need.

## M2 follow-up

Identity is now implemented; see `0003-identity-and-sessions.md`. The server entry point requires database configuration and closes its pool on shutdown. The app factory remains usable without a live database for health tests and contract generation. The original no-domain-table decision described M1; M2 introduces identity tables.

## Consequences and revisit

Clients depend on OpenAPI rather than server imports. Domain modules will own their tables and expose application services. Add database readiness and connection lifecycle management when the first persisted HTTP capability is introduced. Revisit runtime and PostgreSQL versions as support requirements change. Plan retention, backups, deletion, and export before storing substantial personal data.
