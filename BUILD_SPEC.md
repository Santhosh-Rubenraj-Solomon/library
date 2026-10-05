# Surf Library — Full-Stack Build Spec

Base repo: a **Fastify + TypeORM + PostgreSQL** library service (branch `library`).
Goal: (1) fix the backend, (2) run it as replicas behind an **nginx load balancer**
via Docker Compose, (3) add an **Angular** frontend mapped to the existing endpoints,
skinned to the Figma "Surf Library" design.

> This file is the source-of-truth spec this repo was built from. See
> [README.md](./README.md) for how to run it and [SECURITY.md](./SECURITY.md) for the
> Task 4 security posture.

## References

- **Design (Figma):** https://www.figma.com/design/t50jxaPsMihkO9FZAFDwsP/Surf-Library — file "Surf Library".

## Task 0 — Preserve the existing API contract

The current server's `preHandler` hook **rewraps the request body** before handlers
run: `req.body` becomes `{ data: <original body>, user: <decoded JWT user> }`. Route
handlers therefore read `req.body.data.<field>` and `req.body.user.<field>`. **Keep
this contract.** The frontend sends the *unwrapped* body (just `{ bookName, ... }`);
the server does the wrapping.

### Endpoint reference (what the CLIENT sends)

| Method | Path | Access | Client request | Notes |
|---|---|---|---|---|
| POST | `/usersignin` | public | `{ "mailId": "a@b.com" }` | returns JWT string in `data` |
| GET | `/getallbooks` | public | – | full catalog |
| GET | `/healthcheck` | public | – | returns `{ status, servedBy }` |
| GET | `/getbookbyquery` | user | query: `?bookName=&authorName=&language=&genre=&donatedBy=` | any subset |
| POST | `/lendbook` | user | `{ "bookName": "...", "lendDate": "2025-01-01" }` | user comes from token |
| POST | `/returnbook` | user | `{ "bookName": "..." }` | user comes from token |
| GET | `/getbooksreturnedbyuser` | user | – | reads user from token |
| GET | `/lendedbooksbyuser` | user | – | GET-body quirk — fixed |
| POST | `/postnewbook` | **admin** | `{ "bookName","authorName","language","genre","donatedBy" }` | |
| PUT | `/updatebook` | **admin** | same body | matched by bookName |
| DELETE | `/deletebook` | **admin** | query: `?bookName=...` | |
| GET | `/getusers` | **admin** | – | |
| GET | `/getlendedbooks` | **admin** | – | currently lent |
| GET | `/getreturnedbooks` | **admin** | – | |

Auth header: `Authorization: Bearer <token>` (server also accepts the bare token).

**Known quirks (fixed in this build):**
- `/lendedbooksbyuser` was a **GET that read `req.body.data.userId`** — browsers can't
  send a GET body. Now reads the user from the token like `/getbooksreturnedbyuser`.
- **No admin bootstrap**: `/usersignin` always assigned `role: 'user'`. Added a seed
  (`seed-admin.ts`) that creates/promotes an admin.

## Task 1 — Fix the backend

`backend/src/{data-source,db,server}.ts` rewritten; `package.json`/`tsconfig.json`
modernised (TypeScript 5, Fastify 4.26, TypeORM 0.3, jsonwebtoken 9). Entities, routes,
and `rts.ts` preserved except the JWT-secret cast, the `/lendedbooksbyuser` fix, and the
removed unused `require('bcrypt')` (a startup crash with the trimmed deps).

**Acceptance:** `cd backend && npm install && npm run build` exits 0. ✅

## Task 2 — Load balancer (nginx + Docker replicas)

The service is stateless (JWT auth, no server session), so it scales horizontally with
no sticky sessions. 3 replicas behind nginx `least_conn`, all stamping `X-Served-By`.

**Acceptance:** `docker compose up --build` starts everything; repeated
`http://localhost:8080/healthcheck` returns a rotating `X-Served-By`. ✅

## Task 3 — Angular frontend (`frontend/`)

Angular 17 standalone. API base URL points at the **load balancer**
(`http://localhost:8080`). Core: `api.service`, `auth.service`, `auth.interceptor`,
`guards`; features: `catalog`, `my-books`, `admin`, `auth/signin`.

- **Response envelope:** `{ status, data, message }`; `status === "ERROR"` surfaces
  `message` to the user.
- **Signin:** `POST /usersignin` with `{ mailId }` → store `data` (JWT); decode
  client-side for `role`.
- **Send unwrapped bodies.** Query routes use query params.

**Acceptance:** `ng build` succeeds; the stack up, a user can sign in, browse, search,
lend/return; an admin manages books/users. Requests go through `:8080` and
`X-Served-By` rotates. ✅

## Task 4 — Security must-fix

See [SECURITY.md](./SECURITY.md): rotate leaked secrets, add real auth to
`/usersignin`, admin bootstrap (done), migrations instead of `synchronize: true`,
schema validation, pagination, and Redis-backed rate limiting.
