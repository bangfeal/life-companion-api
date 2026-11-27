# Identity, profiles, and revocable bearer sessions

Date: 2026-11-27. Status: implemented for M2.

## Context

Independent web and mobile clients need authentication and private profile access. The API remains a single process with PostgreSQL. Identity must establish application-level ownership before goals or other personal records are added.

## Decision

Use email/password authentication and opaque bearer sessions rather than self-contained JWTs. Registration creates a user and default profile transactionally, then issues a session. Login issues a fresh session. Each session lasts seven days with an absolute expiry; activity does not extend it. Logout deletes only the presented session. Other devices stay signed in. There is no refresh token; clients authenticate again after expiry.

Generate each token from 32 cryptographically random bytes and store only its SHA-256 digest. The raw token is returned once, with `Cache-Control: no-store`, and must be presented in `Authorization: Bearer <token>`. Do not put tokens in URLs. Every private application operation validates the session and resolves its owner from the database. Profile writes repeat the session predicate in the SQL update. User identifiers supplied by a client never select another profile.

Use Node's asynchronous scrypt with a random 16-byte salt, a 64-byte derived key, and N=131072, r=8, p=1. Store a versioned hash encoding; compare derived keys with timingSafeEqual. These parameters follow the [OWASP password-storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Passwords are 15–128 Unicode code points (at most 512 UTF-8 bytes), with no trimming, truncation, or composition rules. Unknown accounts still run scrypt before the same generic invalid-login response. Limit concurrent derivations to two per API process to bound memory usage; saturation returns 503 and Retry-After.

Normalize email to lowercase; the database enforces normalization and uniqueness. Duplicate registration returns a generic 409 (which still reveals that registration could not be completed for that address). Email is an account identifier, not proof of ownership: email verification is not implemented. Profiles contain an optional display name and a validated timezone, defaulting to null and UTC.

Rate-limit registration and login separately to 10 requests per minute per source IP, before validation/hashing. Profile reads allow 120/minute and profile writes/logout 60/minute per IP per route. Limits use a bounded in-process store; they reset on restart and are not distributed protection. Do not trust arbitrary forwarded IP headers; configure a trusted reverse proxy deliberately before deployment. Add account-aware/distributed abuse protection if deployment or exposure requires it.

## Browser and mobile use

The API does not authenticate from cookies, so it does not accept ambient browser cookie credentials. Native clients should use platform secure storage. For browser consumers, prefer a backend-for-frontend keeping the API token server-side and protecting its own secure, HttpOnly cookie with CSRF controls. A direct browser client can keep a short-lived-in-memory copy but must not persist bearer tokens in localStorage. HTTPS is required outside local development. CORS and browser login integration remain consumer-specific decisions; no permissive CORS policy is enabled.

## Persistence and lifecycle

- `users`: UUID, normalized unique email, password hash, creation timestamp.
- `user_profiles`: user-owned profile with cascading FK, optional display name, timezone, update timestamp.
- `auth_sessions`: token digest, cascading owner FK, creation/expiry timestamps, user and expiry indexes, hash and expiry constraints.

Raw passwords and tokens are never persisted or intentionally logged. Public DTOs exclude hashes and session metadata. Expired sessions stop authorizing immediately and are removed opportunistically whenever any new session is issued; an idle database may retain expired digests until the next issuance. Revoked sessions are deleted immediately. User deletion at the database level cascades to profiles and sessions. Account deletion/export APIs, backups/restore, retention automation, recovery, password changes, email verification, and MFA remain later work; do not treat this milestone as readiness for substantial personal-data collection.

Registration is not a general idempotency protocol. A duplicate/racing request cannot create two accounts. If session issuance fails after account creation, login can issue a new session; the account/profile transaction remains valid. Logout retries cannot revoke another device's session; a retry with an already-revoked token returns 401. Requests already authorized before a concurrent logout may complete; subsequent authorization fails. Profile SQL includes a live-session check at write execution.

## Alternatives and consequences

JWTs would avoid some session lookups but complicate immediate revocation and introduce signing-key management. Cookie-only authentication would couple the API to browser semantics. External identity providers remain a future alternative when federation, recovery, or operational requirements justify them.

Database access is now required by `src/main.ts` for identity configuration, but constructing the application and generating OpenAPI do not require a live database. The app factory accepts an injected public identity service; without one, identity routes return sanitized 503 responses while `/health` remains process-only liveness. All routes remain present in the generated contract. Shutdown closes the database pool.

## Verification and revisit

Test HTTP → application → PostgreSQL with two users, client-supplied identity attacks, expired/revoked/invalid tokens, profile validation, duplicate account races, generic login errors, token/hash storage, and rate limits. Tests also call private application operations directly to establish that authorization does not depend on HTTP middleware. Revisit the seven-day expiry, auth abuse policy, cleanup frequency, browser integration, and provider-based identity before public deployment. New domain services must enforce their own resource ownership using trusted identity, not client-supplied IDs.
