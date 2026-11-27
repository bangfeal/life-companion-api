# Life Companion API

REST API for goals, habits, tasks, scheduling, sleep, and education, with authenticated private records and descriptive cross-domain summaries.

The tables below describe currently implemented endpoints. Business paths are relative to **`/api/v1`**. See the committed [OpenAPI 3.1 contract](openapi.json) or `GET /openapi.json` for complete request and response schemas.

## System

| Method | Path            | Description                                            |
| ------ | --------------- | ------------------------------------------------------ |
| GET    | `/health`       | Process liveness; does not check PostgreSQL readiness. |
| GET    | `/openapi.json` | Download the generated API contract.                   |

## Authentication and profiles

Registration and login are public. All other business endpoints require the opaque session token in `Authorization: Bearer <token>`. Sessions expire after seven days; logout revokes only the presented session. Responses containing private data use `Cache-Control: no-store`.

| Method | Path             | Description                                       |
| ------ | ---------------- | ------------------------------------------------- |
| POST   | `/auth/register` | Register an account and issue a seven-day session |
| POST   | `/auth/login`    | Issue a new seven-day bearer session              |
| POST   | `/auth/logout`   | Revoke the presented session only                 |
| GET    | `/me`            | Read the authenticated user and profile           |
| PATCH  | `/me`            | Update only the authenticated user profile        |

Registration/login accept email and a 15–128 character password and return a token, expiry, and public user profile. GET `/me` returns the current user; PATCH accepts displayName (nullable) and timeZone. Email and ownership cannot be changed through profile edits.

## Goals

| Method | Path         | Description       |
| ------ | ------------ | ----------------- |
| POST   | `/goals`     | Create goal       |
| GET    | `/goals`     | List owned goals  |
| GET    | `/goals/:id` | Read owned goal   |
| PATCH  | `/goals/:id` | Update owned goal |
| DELETE | `/goals/:id` | Delete owned goal |

Goals contain title, targetValue, unit, optional manually reported currentValue, description, dueDate, status, and sleep/education domain associations. Responses include progressPercent, capped at 100. Status is active, completed, or archived. Lists filter by status/domain. Due dates are calendar dates. Deleting a goal detaches linked habits/tasks while preserving them.

## Habits and daily logs

| Method | Path               | Description                                    |
| ------ | ------------------ | ---------------------------------------------- |
| POST   | `/habits`          | Create habit                                   |
| GET    | `/habits`          | List owned habits                              |
| GET    | `/habits/:id`      | Read owned habit                               |
| PATCH  | `/habits/:id`      | Update owned habit                             |
| DELETE | `/habits/:id`      | Delete owned habit                             |
| POST   | `/habits/:id/logs` | Set completion for one local date (retry-safe) |
| GET    | `/habits/:id/logs` | List habit logs; date bounds are inclusive     |

Daily habits have a title, immutable IANA timezone, optional owned goalId, and archived flag. Completion logs accept date and completed; repeated writes replace that local date’s value without duplicates. Archived habits retain readable logs but reject log writes. Lists filter by archived/goalId; log bounds fromDate/toDate are inclusive. Deleting a habit deletes its logs.

## Tasks

| Method | Path         | Description       |
| ------ | ------------ | ----------------- |
| POST   | `/tasks`     | Create task       |
| GET    | `/tasks`     | List owned tasks  |
| GET    | `/tasks/:id` | Read owned task   |
| PATCH  | `/tasks/:id` | Update owned task |
| DELETE | `/tasks/:id` | Delete owned task |

Tasks have a title, optional description/goalId/dueAt, and status todo, done, or canceled. Lists filter by status, goalId, dueFrom, and dueTo; due bounds are half-open `[dueFrom,dueTo)`. Deleting a task clears links from events and study observations while preserving those records.

## Scheduled events

| Method | Path                   | Description        |
| ------ | ---------------------- | ------------------ |
| POST   | `/schedule/events`     | Create event       |
| GET    | `/schedule/events`     | List owned events  |
| GET    | `/schedule/events/:id` | Read owned event   |
| PATCH  | `/schedule/events/:id` | Update owned event |
| DELETE | `/schedule/events/:id` | Delete owned event |

Events require title, startsAt, endsAt, and an IANA timeZone, with optional description and owned taskId. End must follow start. Lists filter by taskId and interval overlap with `[from,to)`. Events can overlap; recurrence and all-day events are not implemented.

## Sleep

| Method | Path                  | Description               |
| ------ | --------------------- | ------------------------- |
| POST   | `/sleep/sessions`     | Create sleep record       |
| GET    | `/sleep/sessions`     | List owned sleep records  |
| GET    | `/sleep/sessions/:id` | Read owned sleep record   |
| PATCH  | `/sleep/sessions/:id` | Edit owned sleep record   |
| DELETE | `/sleep/sessions/:id` | Delete owned sleep record |
| GET    | `/sleep/summary`      | Descriptive sleep summary |

Reported sleep sessions require startsAt, endsAt, and timeZone. Optional fields are awakeMinutes, kind (main/nap), subjective quality (1–5), and notes. Responses include durationMinutes, sleepMinutes, and manual provenance. Sessions must be completed, at most 48 elapsed hours, and leave positive sleep time. Overlapping sleep records for the same user return 409. History filters by overlap and kind; summaries use the rules below.

## Education

| Method | Path                        | Description                                  |
| ------ | --------------------------- | -------------------------------------------- |
| POST   | `/study/sessions`           | Create study record                          |
| GET    | `/study/sessions`           | List owned study records                     |
| GET    | `/study/sessions/:id`       | Read owned study record                      |
| PATCH  | `/study/sessions/:id`       | Edit owned study record                      |
| DELETE | `/study/sessions/:id`       | Delete owned study record                    |
| POST   | `/examinations`             | Create exam record                           |
| GET    | `/examinations`             | List owned exam records                      |
| GET    | `/examinations/:id`         | Read owned exam record                       |
| PATCH  | `/examinations/:id`         | Edit owned exam record                       |
| DELETE | `/examinations/:id`         | Delete owned exam record                     |
| GET    | `/study/summary`            | Descriptive education summary                |
| POST   | `/study/tasks/:id/schedule` | Schedule an owned todo task as a study event |

Study sessions require subject, startsAt, endsAt, and timeZone; optional fields include activity, breakMinutes, taskId, examinationId, and notes. Responses include durationMinutes, focusedMinutes, and manual provenance. Completed intervals are at most 24 hours and cannot overlap another study session for the same user. Lists filter by overlap, subject, taskId, and examinationId.

Examinations require title, subject, scheduledAt, and timeZone. Optional durationMinutes/status and paired score/maxScore support results; grades require completed status and valid score bounds. Lists filter by scheduled-time bounds, subject, and status. Deleting an examination detaches linked study sessions without deleting observations.

Scheduling a study task requires an owned todo task plus subject, startsAt, endsAt, and timeZone. It creates a normal calendar event; it does not record study, complete the task, or update goal progress.

## Cross-domain review

| Method | Path                     | Description                                       |
| ------ | ------------------------ | ------------------------------------------------- |
| GET    | `/analytics/sleep-study` | Review recorded sleep and study progress together |

The review combines public sleep and education summaries with a joined daily table. Missing observations remain null; they are not treated as evidence of zero actual activity. It calculates no correlation, causal conclusion, or health recommendation.

## Collection and summary conventions

- Collections use limit 1–100 (default 20), offset 0–10000, and return items, limit, offset, and nextOffset. Session history sorts by ending time descending; events by start ascending; other resources use their documented timestamps with UUID tie-breakers.
- Instants require Z or an explicit offset and return UTC; IANA timezones preserve display/grouping context. Query-string plus signs in offsets must be URL-encoded.
- Summary endpoints require from/to, accept timeZone (default UTC), and allow at most 93 elapsed days. They include complete sessions **ending in `[from,to)`**, assigning full net minutes to the ending local date. This differs from overlap-based history filters.
- Summary sources are capped at 10,000 contributing rows each; exceeding the cap returns 409 rather than truncated totals. Sparse averages are null. Sleep consistency compares adjacent recorded main-session bedtimes circularly; education percentages are descriptive, not a course grade.
- PATCH changes only supplied fields. Null clears explicitly nullable fields. Unknown fields and client-supplied ownership are rejected.
- Mutation routes are rate-limited. General resource creation has no idempotency key; uncertain POST retries can create duplicates. Habit-log upserts are retry-safe.

## Responses and errors

Creates return 201, reads/updates 200, and deletes/logout 204 with an empty body. Habit-log writes return 200. Errors use `application/problem+json`.

| Status    | Meaning                                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------------------------------- |
| 400       | Invalid input, timezone, interval, result, or query window.                                                                |
| 401       | Missing, invalid, expired, or revoked credentials.                                                                         |
| 404       | Resource does not exist for the authenticated user.                                                                        |
| 409       | Duplicate account, overlap, archived-habit write, changed relationship, non-todo study task, or summary-capacity conflict. |
| 413 / 415 | Body too large / unsupported media type.                                                                                   |
| 429       | Rate limit exceeded; honor Retry-After.                                                                                    |
| 500 / 503 | Unexpected failure / unavailable service or password-processing capacity.                                                  |

Implemented scope is M1–M5. Recommendation rules, AI/approved actions, email verification/recovery, MFA, and account export/deletion endpoints remain future work.
