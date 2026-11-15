# Patched development dependencies

## Context

On 2026-11-15, npm audit reported 11 moderate findings, all in development tooling. These traced to two advisories:

- [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249): minimatch pattern amplification; fixed in 11.0.1. typescript-eslint 8.72.2 still requests minimatch 10.x.
- [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99): esbuild development-server request exposure; fixed in 0.25.0. Drizzle Kit 0.31.11 includes a legacy @esbuild-kit loader requesting esbuild 0.18.x.

The installed stable parent releases had no direct upgrade resolving both issues. npm's force-fix suggestions included downgrading the parent tools.

## Decision

Use npm overrides: `minimatch: ^11.0.4`, and `@esbuild-kit/core-utils > esbuild: ^0.25.12`. The lockfile resolves these to 11.0.8 and 0.25.12 respectively. Existing ESLint dependencies already use minimatch 11; the override also patches typescript-eslint's nested copy. A parent-scoped minimatch override initially retained an invalid old lockfile resolution, so the final minimatch override covers the dependency tree.

These are deliberate overrides outside the parents' declared ranges. Verify compatibility through linting, type checking, unit/HTTP tests, production compilation, OpenAPI export, Drizzle schema generation, and PostgreSQL migrations/integration tests. Keep a full dependency audit in CI, including development tooling.

## Alternatives and consequences

Leaving the findings unresolved preserves vulnerable tooling; force-fixing would downgrade established tools and may break configuration. Switching ORM or linter is disproportionate. Overrides retain current tools but require maintenance and compatibility checks; a zero audit report only describes known advisories at verification time.

## Revisit

Remove each override when a compatible stable parent release naturally resolves a patched dependency. Re-run `npm ci`, `npm audit`, the normal checks, and database/generation checks after dependency changes. Do not expose tooling development servers to untrusted clients.
