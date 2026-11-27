# M3 life-management API

All routes below are under `/api/v1`, require `Authorization: Bearer <session token>`, and operate only on the authenticated user's records. See `/openapi.json` for complete request/response schemas and the identity guide for obtaining a token.

## Resource endpoints

| Resource     | Create / list                 | Read / patch / delete                       |
| ------------ | ----------------------------- | ------------------------------------------- |
| Goals        | POST / GET `/goals`           | GET / PATCH / DELETE `/goals/:id`           |
| Daily habits | POST / GET `/habits`          | GET / PATCH / DELETE `/habits/:id`          |
| Tasks        | POST / GET `/tasks`           | GET / PATCH / DELETE `/tasks/:id`           |
| Timed events | POST / GET `/schedule/events` | GET / PATCH / DELETE `/schedule/events/:id` |

Creates return 201, reads/patches return 200, and deletes return 204 with no body. IDs are UUIDs. Do not supply userId or extra fields. Responses exclude internal ownership columns. Omitted PATCH fields stay unchanged; null clears only fields explicitly documented as nullable. Empty patches are rejected.

## Goals

Example create body:

```json
{
  "title": "Study for the examination",
  "description": "Twenty focused study hours",
  "targetValue": 20,
  "currentValue": 3,
  "unit": "hours",
  "dueDate": "2027-01-31",
  "domains": ["education"],
  "status": "active"
}
```

Required: title, targetValue, unit. Defaults: currentValue 0, status active, domains empty, description/dueDate null. Numbers must be finite and between 0 and 1e12; target must be greater than zero. Status is active, completed, or archived. The due date is a calendar date, not an instant. Descriptions are nullable (up to 2000 characters), titles up to 200, and units up to 50. Non-null text must not be blank.

Responses add id, createdAt, updatedAt, and progressPercent (current/target × 100, rounded to two decimals, capped at 100). Progress is manually updated; status is independent. No study or sleep measurements are automatically aggregated. Domain associations support sleep and education, without implying those modules exist. PATCH domains replaces the whole set; an empty array clears it.

Filters: status and domain.

## Daily habits and logs

```json
{
  "title": "Read before bed",
  "timeZone": "Europe/Madrid",
  "goalId": null,
  "archived": false
}
```

Only title is required; timeZone defaults to UTC. A non-null goalId must reference your own goal. Timezone is fixed at creation. PATCH may change title, goalId, and archived. Filters: archived and goalId.

Set completion for a habit's local calendar date:

```http
POST /api/v1/habits/:id/logs
Content-Type: application/json
```

```json
{ "date": "2026-11-27", "completed": true }
```

Returns 200 with date, completed, createdAt, and updatedAt. Repeating the same request does not add a duplicate log; sending completed false replaces the value for that date. The date is interpreted in the habit's stored timezone, supplied explicitly by the user rather than guessed from server time. Archived habits reject writes with 409 but retain readable history.

GET `/habits/:id/logs` lists logs. Filters: fromDate and toDate, both inclusive. Logs are ordered by local date descending. Weekly/custom recurrences, streaks, reminders, and automatic goal progress are not implemented.

## Tasks

```json
{
  "title": "Review chapter three",
  "description": "Complete practice questions",
  "goalId": "00000000-0000-4000-8000-000000000001",
  "dueAt": "2026-12-01T17:00:00+01:00",
  "status": "todo"
}
```

Only title is required; status defaults to todo and other optional fields to null. Status is todo, done, or canceled. Due instants require Z or an explicit offset and return normalized UTC. PATCH can clear dueAt/goalId/description with null.

Filters: status, goalId, dueFrom, dueTo. Due bounds form `[dueFrom,dueTo)`; tasks without a due instant are excluded when a due filter is supplied. Marking a task done does not modify any linked goal automatically.

## Scheduled events

```json
{
  "title": "Chapter review",
  "taskId": "00000000-0000-4000-8000-000000000002",
  "startsAt": "2026-12-01T16:00:00+01:00",
  "endsAt": "2026-12-01T17:00:00+01:00",
  "timeZone": "Europe/Madrid"
}
```

Required: title, startsAt, endsAt, timeZone. Description and taskId are nullable. A linked task must be yours. End must be after start by instant, including across DST transitions. Explicit offsets resolve ambiguous local times; timeZone is preserved for display and does not reinterpret the supplied instant. Timestamps support up to millisecond precision. Events may overlap; recurrence and all-day events are not implemented.

Filters: taskId, from, to. Results overlap `[from,to)`: event.end > from and event.start < to. An event ending exactly at from, or starting exactly at to, is excluded. One-sided bounds are supported. Partial interval updates validate the merged persisted event under a row lock.

## Pagination and timestamps

Every collection supports limit (default 20, maximum 100) and offset (default 0, maximum 10000):

```json
{
  "items": [],
  "limit": 20,
  "offset": 0,
  "nextOffset": null
}
```

A non-null nextOffset identifies the next page within the offset bound. At the 10000 cap, nextOffset is null even if more rows exist; narrow filters for large datasets. No total count is returned. Goals/habits/tasks sort by creation descending, events by start ascending, with UUID tie-breakers. Concurrent changes can shift offset pages.

Record creation/update timestamps return UTC. Calendar dates remain date-only. Database triggers also update resource timestamps when a linked parent is deleted and its reference is cleared.

## Deletion, retries, and errors

Deleting a goal detaches its habits/tasks without deleting them. Deleting a task detaches scheduled events without deleting events. Deleting a habit removes its logs. Deleting events removes those records. Account deletion at the database level cascades all owned records; there is no account-deletion HTTP endpoint yet.

POST resource creation is not automatically retry-safe: an uncertain retry may create another record. Habit log upserts and PATCH assignments are retry-safe for their intended state. Repeated DELETE returns 404 after the first success. Later conflicting changes can still be overwritten; optimistic version checks are deferred to a concrete consumer/assistant requirement.

All private responses are no-store. Errors are sanitized Problem Details:

| Status    | Meaning                                                                       |
| --------- | ----------------------------------------------------------------------------- |
| 400       | Invalid field, UUID, number, date, timezone, interval, filter, or empty patch |
| 401       | Missing/invalid/expired/revoked bearer session                                |
| 404       | Resource or referenced resource does not exist for the authenticated user     |
| 409       | Archived habit log write or a relationship changed during a write             |
| 413 / 415 | Body too large / unsupported media type                                       |
| 429       | Per-route write rate limit exceeded; honor Retry-After                        |
| 500 / 503 | Unexpected failure / service not configured                                   |

Mutation routes allow 60 requests/minute per source IP per route with process-local counters. Resource bodies are capped at 16 KiB; habit log bodies at 4 KiB. Filter queries reject unknown fields. Privacy/export/backup limitations from the identity milestone still apply.

## Local verification

```sh
sudo docker compose up -d --wait
npm run db:migrate
npm run dev
```

Use an explicitly disposable database for `npm run test:integration`; the suite applies migrations and removes only accounts it creates. The new migrations were verified in an isolated PostgreSQL container, without modifying the user's development database. See the M3 architecture decision for constraint and migration ownership details.
