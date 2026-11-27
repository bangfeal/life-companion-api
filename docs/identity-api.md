# M2 identity API

All examples use the local server. Production requires HTTPS. Secrets below are placeholders, not project credentials. OpenAPI at `/openapi.json` is the authoritative schema.

## Endpoints

| Method and path              | Input                                     | Success                                    |
| ---------------------------- | ----------------------------------------- | ------------------------------------------ |
| POST `/api/v1/auth/register` | email, password                           | 201: session and public user               |
| POST `/api/v1/auth/login`    | email, password                           | 200: new session and public user           |
| POST `/api/v1/auth/logout`   | Bearer token                              | 204: empty body; presented session revoked |
| GET `/api/v1/me`             | Bearer token                              | 200: public user and profile               |
| PATCH `/api/v1/me`           | Bearer token, displayName and/or timeZone | 200: updated public user                   |

Registration and login return:

```json
{
  "accessToken": "<opaque random token>",
  "tokenType": "Bearer",
  "expiresAt": "2026-12-04T12:00:00.000Z",
  "user": {
    "id": "00000000-0000-4000-8000-000000000001",
    "email": "alice@example.com",
    "createdAt": "2026-11-27T12:00:00.000Z",
    "profile": { "displayName": null, "timeZone": "UTC" }
  }
}
```

The token is not a JWT. It expires seven days after issuance, is not renewed by reads, and must be kept private. Login creates an independent session. There is no refresh token. The API only accepts tokens in the Authorization header, not cookies or query parameters.

## Example flow

After `npm run db:migrate` and `npm run dev`:

```sh
curl -i -X POST http://127.0.0.1:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"a long example password"}'

curl -i http://127.0.0.1:3000/api/v1/me \
  -H 'Authorization: Bearer <token from registration or login>'

curl -i -X PATCH http://127.0.0.1:3000/api/v1/me \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"displayName":"Alice","timeZone":"Europe/Madrid"}'

curl -i -X POST http://127.0.0.1:3000/api/v1/auth/logout \
  -H 'Authorization: Bearer <token>'
```

Do not paste real tokens/passwords into shared shell history or logs. A frontend should collect credentials securely and handle responses without logging them. See the authentication decision for browser and mobile storage guidance.

## Validation and authorization

Email is case-insensitive. Passwords require 15–128 characters and are never trimmed. Registration creates a default UTC profile. Display names are trimmed, nonempty when supplied, and at most 100 characters; null clears the name. Timezones must be UTC or a recognized IANA identifier. PATCH changes only supplied fields. Empty patches and extra fields (including userId, id, and email) are rejected.

There is no endpoint accepting a target user's ID: `/me` always resolves the owner from the valid session. The application service also authenticates private operations, so internal callers cannot bypass HTTP authorization by supplying a different user ID.

All identity responses use `Cache-Control: no-store`. Errors use `application/problem+json`; validation and database details are not returned.

| Status    | Meaning                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------- |
| 400       | Invalid body/query, empty patch, invalid timezone, or password policy violation                          |
| 401       | Invalid login or missing/malformed/expired/revoked session; WWW-Authenticate: Bearer                     |
| 409       | Duplicate registration could not be completed                                                            |
| 413 / 415 | Body too large (registration, login, and profile updates cap bodies at 4 KiB) / unsupported content type |
| 429       | Per-IP rate limit exceeded; honor Retry-After                                                            |
| 500       | Unexpected server/persistence error                                                                      |
| 503       | Identity service unavailable or concurrent password capacity exceeded; retry later                       |

Registration/login each allow 10 attempts per minute per IP; reads allow 120, profile updates/logout 60 per route. Limits are process-local. Revoking a session leaves other sessions valid. Repeating logout with the same token returns 401 and has no further effect.

## Testing and current limits

Use only an explicitly disposable database:

```sh
TEST_DATABASE_URL=postgres://companion:companion@localhost:5432/life_companion_test npm run test:integration
```

The integration suite applies migrations and deletes only accounts it creates. Test files run serially because they share migration setup. Account recovery, verification email, password changes, MFA, account deletion/export, and browser BFF integration are not implemented. `/health` does not assert database readiness. M2 introduces identity persistence; no goals, sleep, or education features are included.
