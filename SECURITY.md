# Security notes (BUILD_SPEC Task 4)

This is a demo. It is intentionally functional out of the box, which means a few
things must change before any real deployment. Each item below says what was **done**
here and what is **left** as a must-fix.

## 1. Leaked secrets — rotate & keep them out of git

- **Done:** this repo never commits a real `.env`. Only `backend/.env.example` is
  tracked, and `.env` is git-ignored.
- Generate a strong JWT secret before running anything non-local:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
  Put it in `JWT` (in `.env` and `docker-compose.yml`), never the placeholder.

## 2. `/usersignin` has no real authentication

- **Current behaviour:** a token is issued from just a `mailId`. Anyone can mint a
  user token for any email. The demo keeps this so the flow works end-to-end.
- **Must-fix:** add a credential. The original repo already carried `bcrypt` for this.
  Concretely:
  1. Add `passwordHash: string` to the `Users` entity.
  2. On first sign-up, hash with `bcrypt`; on sign-in, `bcrypt.compare`.
  3. Add a password field to the Angular sign-in form and send it in the body.
  4. Re-add `bcrypt` to `backend/package.json` (and the alpine build deps).
  Or replace the whole flow with SSO / OAuth.

## 3. Admin bootstrap

- **Done:** `backend/src/seed-admin.ts` creates or promotes an admin
  (`ADMIN_EMAIL`, default `admin@surflibrary.dev`). It runs automatically as the
  one-shot `seed-admin` Compose service, or manually via `npm run seed:admin`.
  Without it, `/usersignin` only mints `user` tokens and the admin routes 403.

## 4. `synchronize: true` → migrations

- **Current:** `data-source.ts` uses `synchronize: true` so the schema is created
  automatically for the demo. This can drop/alter columns unexpectedly.
- **Must-fix:** set `synchronize: false` and manage schema with TypeORM migrations
  (`typeorm migration:generate` / `migration:run`) before production.

## 5. Hardening backlog

- **Request-schema validation** — add Fastify JSON schemas per route so malformed
  bodies/queries are rejected with 400 before hitting handlers.
- **Pagination** — `/getallbooks` returns the whole table; add `limit`/`offset`.
- **Rate limiting** — add `@fastify/rate-limit` backed by **Redis** so the limit is
  shared across the three replicas (in-memory limits don't work behind the LB).
- **CORS** — `CORS_ORIGIN` is pinned to `http://localhost:4200`; set it to the real
  origin(s) in production rather than falling back to `true` (reflect-any).
- **Token lifetime** — tokens last 24h with no refresh/revocation; consider shorter
  lifetimes + refresh tokens.

## Dependency advisories

`npm audit` reports advisories in the pinned toolchains (older Fastify plugins on the
backend, the Angular 17 build chain on the frontend). Review and bump on a cadence;
none are exploitable in the demo's local-only setup, but don't ship without triaging.
