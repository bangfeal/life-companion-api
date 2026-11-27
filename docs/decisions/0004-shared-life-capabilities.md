# M3 shared life-management capabilities

Date: 2026-11-27. Status: implemented on the M3 feature branch.

## Context and decision

Deliver useful goals, daily habits/logs, tasks, and timed events as a modular monolith. Each capability owns its domain types, validation, application operations, repository port, PostgreSQL adapter, and HTTP schemas. `src/life-management.ts` is a composition root using only published module services; it is not a business module or a universal CRUD framework.

Identity publishes `authenticate(token)` returning a trusted user ID. Every M3 application operation calls it, including operations invoked outside HTTP. Every resource read/write/delete includes the resolved owner in its SQL predicate. Bodies cannot supply ownership. Unknown and other users' resource IDs return the same 404. Collections never include other owners' rows.

Habits and tasks validate optional goal links through the goals public read service. Scheduling validates task links through the tasks public read service. No business module queries a peer's repository or tables. The global schema-discovery file remains the only code location importing all module tables.

## Models and semantics

- Goals: positive numeric target, nonnegative manually reported current value, unit, optional description and calendar due date, explicit active/completed/archived status. Derived progress is current/target × 100, rounded to two decimals and capped at 100. Values are finite and bounded to 1e12. Status is not automatically inferred from progress. Domain associations are a relational set of sleep/education codes; an empty set means a general goal. This is metadata, not an implementation of those specialized domains.
- Habits: daily completion only, fixed IANA timezone, optional goal, archival flag. One Boolean completion per local date; repeated POSTs replace that date's value rather than append duplicate observations. Archived habits retain history but reject new/replacement logs with 409. Timezones cannot be edited because historical local dates would become ambiguous. No recurrence scheduler, reminders, streak algorithm, or automatic goal aggregation is introduced.
- Tasks: title, optional description/goal/due instant, explicit todo/done/canceled status. Scheduling a task does not change its due time or completion state automatically.
- Events: explicit start/end instants, IANA display timezone, optional task. End must be after start. Events may overlap and are neither recurring nor all-day. Offset-bearing instants are normalized to UTC. On PATCH, lock the existing row and validate the merged interval so simultaneous edits cannot commit an invalid interval.

These records are manually entered facts. Progress percentage is derived, not persisted. Imports and provenance extensions belong to the milestones that introduce them.

## Database relationships and migrations

`0002_life_management.sql` adds goals, goal_domains, habits, habit_logs, tasks, and schedule_events. `0003_ownership.sql` adds relationship/date-query indexes, explicit cross-module foreign keys, and update timestamp triggers.

Cross-module foreign keys are written explicitly in the SQL migration rather than importing another module's private Drizzle tables. They reference users for cascading account ownership and composite (resource ID, owner ID) keys for goal/task links. [PostgreSQL's constraint model](https://www.postgresql.org/docs/17/ddl-constraints.html) supports composite references and setting only the optional link column to null on parent deletion.

Deleting a goal preserves tasks/habits and clears their goal link. Deleting a task preserves events and clears their task link. Deleting a habit deletes its logs. Deleting an account at the database level cascades all its resources. A small timestamp trigger updates explicit and FK-driven changes. Domain link rows and habit logs cascade with their owning parent. Foreign-key conflicts caused by a relationship disappearing after application validation map to sanitized 409 responses at the persistence boundary.

The cross-module FK/trigger contracts intentionally do not appear in Drizzle snapshots. Preserve them when writing future migrations; `db:generate` covers declared tables/indexes and does not replace reviewed SQL. Do not use schema-push/reset workflows that bypass these migrations. Integration tests exercise actual constraints and deletion behavior.

## Pagination, filtering, and retries

All lists use bounded limit/offset pagination (default 20, maximum 100; offset 0–10000), fetch one extra row for nextOffset, and have a deterministic ID tie-breaker. This is not a snapshot cursor: concurrent inserts/deletes can shift pages. Ordering is creation descending for goals/habits/tasks, start ascending for events, and local date descending for logs. Event filters return interval overlap; task due filters use half-open bounds; habit-log calendar date filters include both endpoints.

Habit log upserts and PATCH field assignments are safe to retry for their intended state. DELETE retries return 404 after the first successful deletion. Resource POST creation is not idempotent; clients must not automatically retry uncertain creates. A durable creation-idempotency protocol can be introduced when a concrete consumer requires it. All mutating routes are per-IP rate-limited; identity's deployment limitations still apply.

## Privacy and lifecycle

Private responses use no-store; the existing sanitized errors and logging policy apply. Individual delete operations physically remove owned records, with the link preservation rules above. There is no automatic expiry of life records: they remain until explicitly deleted or their owner is deleted. Account export/deletion APIs and backup retention/restore remain M8 work; do not claim readiness for substantial production personal-data storage. Before such use, define and exercise backups, deletion across backups, export, retention, and least-privilege database access.

## Alternatives and revisit

Avoid automatic progress aggregation, an arbitrary domain registry, recurrence engines, universal repositories, or recommendations without real domain requirements. Keep schemas explicit and extend the supported domain catalog deliberately. Revisit offset pagination for large history volumes, idempotency for independent consumers, decimal precision when measurements need it, and optimistic concurrency before approved assistant writes.

## Verification

Domain calculations are tested without HTTP/PostgreSQL. PostgreSQL integration covers all capabilities, ownership and peer links, goal associations, date/query validation, log retries, overlap filtering, concurrent interval edits, cascades, and link detachment. Existing M1/M2 checks remain required. Production deployment requires migration execution before enabling these routes.
