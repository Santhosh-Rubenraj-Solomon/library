# Surf Library

A small full-stack community library:

- **Backend** — Fastify + TypeORM + PostgreSQL, run as **3 stateless replicas**
  behind an **nginx** load balancer (Docker Compose).
- **Frontend** — Angular 17 (standalone components), pointed at the load balancer
  so you can watch requests fan out across the replicas.

Built from [`BUILD_SPEC.md`](./BUILD_SPEC.md).

```
┌───────────┐      ┌───────────────┐      ┌────────── backend-1 ─┐
│  Angular  │  →   │  nginx :8080  │  →   │  backend-2  (Fastify)│  →  PostgreSQL
│  :4200    │      │ (least_conn)  │      │  backend-3           │
└───────────┘      └───────────────┘      └──────────────────────┘
                     X-Served-By: backend-1 | -2 | -3  (rotates)
```

---

## Repo layout

```
.
├── backend/            # Fastify + TypeORM service (fixed)
│   ├── src/
│   │   ├── server.ts           # bootstrap + auth gate (JWT → { data, user })
│   │   ├── data-source.ts      # TypeORM DataSource
│   │   ├── db.ts               # fastify plugin exposing repositories
│   │   ├── seed-admin.ts       # creates/promotes an admin user
│   │   ├── rts.ts              # public / admin route lists
│   │   ├── entity/             # Library, Lend, Users
│   │   └── routes/             # library / lend / return / user routes
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
├── frontend/           # Angular 17 app
│   └── src/app/{core,models,features,shared}
├── nginx/nginx.conf    # least_conn load balancer over backend1/2/3
├── docker-compose.yml  # postgres + 3 backends + seed-admin + nginx
├── SECURITY.md         # Task 4 — security posture & must-fixes
└── README.md
```

---

## Quick start (Docker — the whole backend + LB)

Requires Docker Desktop.

```bash
docker compose up --build
```

This starts PostgreSQL, three backend replicas, a one-shot admin seeder, and nginx.
The API is exposed at **http://localhost:8080**.

**See the load balancer working** — hit the health endpoint a few times and watch
`X-Served-By` (and `servedBy`) rotate across `backend-1 / -2 / -3`:

```bash
for i in 1 2 3 4 5 6; do curl -s -D - http://localhost:8080/healthcheck -o /dev/null | grep -i x-served-by; done
```

The `seed-admin` service runs once and promotes `admin@surflibrary.dev` to admin
(override with `ADMIN_EMAIL`). Re-run it any time with:

```bash
docker compose run --rm seed-admin
```

## Quick start (frontend)

```bash
cd frontend
npm install
npm start          # ng serve → http://localhost:4200
```

The app talks to the load balancer at `http://localhost:8080`
(`frontend/src/environments/environment.ts`). Sign in with any email to get a
user card, or with the seeded admin email to unlock the **Admin** console.

## Local backend (without Docker)

```bash
cd backend
cp .env.example .env          # then edit JWT + DB creds
npm install
npm run build
npm run seed:admin            # one-time: create the admin user
npm start                     # http://localhost:3001
```

Needs a reachable PostgreSQL (`HOST`/`DBPORT`/`DBUSERNAME`/`DBPASS`/`DBNAME`).

---

## API reference (what the **client** sends)

Base URL = the load balancer, `http://localhost:8080`.
Auth header: `Authorization: Bearer <token>`.

Every endpoint returns the envelope `{ status: "SUCCESS" | "ERROR", data, message }`.

| Method | Path | Access | Client request |
|---|---|---|---|
| POST | `/usersignin` | public | `{ "mailId": "a@b.com" }` → JWT in `data` |
| GET | `/getallbooks` | public | – |
| GET | `/healthcheck` | public | – → `{ status, servedBy }` |
| GET | `/getbookbyquery` | user | `?bookName=&authorName=&language=&genre=&donatedBy=` |
| POST | `/lendbook` | user | `{ "bookName", "lendDate" }` (user from token) |
| POST | `/returnbook` | user | `{ "bookName" }` |
| GET | `/getbooksreturnedbyuser` | user | – (user from token) |
| GET | `/lendedbooksbyuser` | user | – (user from token — see fix below) |
| POST | `/postnewbook` | admin | `{ "bookName","authorName","language","genre","donatedBy" }` |
| PUT | `/updatebook` | admin | same body, matched by `bookName` |
| DELETE | `/deletebook` | admin | `?bookName=...` |
| GET | `/getusers` | admin | – |
| GET | `/getlendedbooks` | admin | – |
| GET | `/getreturnedbooks` | admin | – |

**The request contract is preserved:** the server's `preHandler` rewraps the body
into `{ data: <original body>, user: <decoded JWT user> }`, so handlers read
`req.body.data.<field>` and `req.body.user.<field>`. The **client sends the
unwrapped body** (e.g. `{ bookName, lendDate }`); the server does the wrapping.

### Fixes applied vs. the original backend

- **`server.ts` rewritten** — proper `401/403`, synchronous JWT verify, CORS,
  per-instance `X-Served-By` header, and the `{ data, user }` body contract kept
  intact. Public routes are left unwrapped (so `/usersignin` reads `req.body.mailId`).
- **`/lendedbooksbyuser`** used to read `req.body.data.userId` from a **GET body**
  (browsers can't send one). Now reads the user from the verified token, like
  `/getbooksreturnedbyuser`.
- **Admin bootstrap** — `/usersignin` only ever mints `role: "user"`, so admin
  routes were unreachable. `seed-admin.ts` (and the `seed-admin` compose service)
  create/promote an admin account.
- **`db.ts` / `data-source.ts`** — migrated off the removed TypeORM `createConnection`
  legacy API to an explicit `DataSource`.
- **Startup crash removed** — `user-routes.ts` did `require('bcrypt')` at module load
  while `bcrypt` was dropped from deps; the unused import is gone. JWT secret is cast
  for `jsonwebtoken` v9.
- **Return bug fixed** — `/returnbook` stored `returnDate` via `Date()` (a *string*),
  which Postgres rejects for a `timestamp` column; now uses `new Date()`.
- **Secrets no longer committed** — the original repo committed a real `.env`; here
  only `.env.example` is tracked (see [SECURITY.md](./SECURITY.md)).

---

## Frontend

Angular 17 standalone app. Highlights:

- `core/api.service.ts` — one method per endpoint.
- `core/auth.service.ts` — stores the JWT, decodes the `user` claim client-side,
  exposes `isLoggedIn` / `isAdmin` as signals.
- `core/auth.interceptor.ts` — attaches `Bearer` to every non-public request.
- `core/guards.ts` — `authGuard` + `adminGuard` (mirrors the server's admin list).
- `features/` — `catalog` (browse/search/borrow), `my-books` (loans + history),
  `admin` (books CRUD, users, lending), `auth/signin`.

Design tokens live in `frontend/src/styles/_tokens.scss`. They're an intentional
coastal-library theme; swap in Figma "Surf Library" Dev Mode values there and every
component follows (they read the `--sl-*` custom properties).

Build: `cd frontend && npm run build` → `dist/surf-library`.

---

## Security

The demo keeps email-only sign-in so it runs end-to-end out of the box. Before any
real deployment, read **[SECURITY.md](./SECURITY.md)** — it covers password auth,
secret rotation, migrations (vs. `synchronize: true`), schema validation,
pagination, and shared rate limiting.
