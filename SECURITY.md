# Security Policy

## Reporting a vulnerability

**Do not open a public issue for a security problem.** This repository is public, and an issue makes
the details available to everyone before a fix exists.

Report privately through
[GitHub Security Advisories](https://github.com/brunocbarbosa/NexusOps_frontend/security/advisories/new).
Include what you can: affected version or commit, reproduction steps, and the impact you observed.

Expect a first response within 7 days. This is a personal project, not a staffed product — the
timeline reflects that.

## Supported versions

Only the `main` branch is supported. There are no maintenance releases.

## What the pipeline already checks

Every pull request runs, and every merge re-runs:

| Check | Tool | Blocks the merge when |
| --- | --- | --- |
| SAST | CodeQL (`security-extended`) | a query of at least medium precision finds a vulnerability |
| Dependency review | `actions/dependency-review-action` | the PR adds a dependency with a high CVE or a denied license |
| Runtime dependencies | `npm audit --omit=dev` | a production dependency has a high or critical CVE |
| Secret scan | gitleaks | a credential appears anywhere in the PR history |
| Code quality | SonarQube Cloud Quality Gate | the gate fails, including its security hotspots |

CodeQL and the audit also run weekly on a schedule, because a CVE is published without anyone
pushing a commit.

## Product-side security decisions

These live in the code, not the pipeline, and are documented in
[`documents/backend/USERS.md`](./documents/backend/USERS.md) and
[`CLAUDE.md`](./CLAUDE.md):

- The access token lives in an `httpOnly` cookie and never reaches JavaScript. The browser does not
  talk to the API directly — Next.js Route Handlers proxy it.
- Refresh is serialized on the server. The API rotates refresh tokens and revokes the whole family
  on reuse, so two concurrent refreshes would log the user out.
- The API answers `401` identically for a wrong password, an unknown user and an unknown tenant, and
  `404` rather than `403` for another tenant's resources. The UI must not undo that by
  distinguishing the cases.
- No screen sends `tenantId`. The backend derives the tenant from the request context.
