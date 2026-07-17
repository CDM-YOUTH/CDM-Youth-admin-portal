# Proposal: Dedicated Backend Service Architecture

Status: **Proposed — not yet approved for implementation**
Date: 2026-07-17
Author: Claude (Claude Code), for review by Paul

## 1. Problem statement

The system currently ships as a set of frontend apps (`admin` at the repo root, `apps/youth-portal`) that each talk **directly to Postgres** via `@supabase/supabase-js`, using an anon key plus Row Level Security (RLS) policies for authorization. There is no dedicated backend service — "the backend" today is just a hosted Postgres + Auth + Storage instance that every frontend calls into.

This has worked while there were two apps and a small feature set, but it creates three concrete problems as the system grows:

1. **Business logic is duplicated and scattered.** Rules like the uniform order lifecycle (confirm → dispatch → deliver, with stock adjustments), event-delete notification fan-out, and CDM ID issuance live as ad hoc TypeScript in `src/lib/db/*.ts`. Every new frontend (a future public youth website, a native app) would need to reimplement these rules rather than call one shared implementation.
2. **No safe place for secrets or server-only integrations.** M-Pesa STK Push and SMS provider webhooks need a service-role credential and must run server-side. Right now there is no server tier to host that — it would have to live in a frontend app's server functions, which is a poor fit long-term.
3. **Tooling lock-in and type drift.** Both frontend apps depend on `@lovable.dev/vite-tanstack-config`, a third-party scaffold that hardcodes ports and blocks certain import paths. Supabase types are hand-maintained in two places (`packages/shared` and the admin app's own copy) and have already drifted out of sync once this session.

## 2. Goal

Move to a standard three-tier shape:

- **One backend service** owns all business logic and is the *only* thing that ever opens a direct connection to the database.
- **Frontend apps become pure HTTP clients** — admin portal, youth portal (mobile PWA), and any future app (public youth website, native app) — each living in its own independent repo, none of them importing a database driver or holding a DB credential.
- The backend is built as a **modular monolith**: one deployable service, internally organized by domain, so any domain can be peeled out into its own microservice later if it actually needs to scale independently. No microservices on day one — that's operational cost with no payoff yet at this scale.

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Admin Portal │   │ Youth Portal │   │ Youth Website│  ← independent repos,
│  (own repo)  │   │ (own repo,   │   │  (future,    │    frontend-only,
│              │   │  mobile PWA) │   │  own repo)   │    no DB driver at all
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │  HTTPS / JSON only │                  │
       └──────────────┬──────┴──────────────────┘
                       ▼
              ┌─────────────────┐
              │   cdm-backend    │   ← NEW single repo, the only thing
              │  (API service)   │      that ever opens a DB connection
              └────────┬─────────┘
                       │ direct Postgres connection (trusted)
                       ▼
              ┌─────────────────┐
              │    Postgres      │
              └─────────────────┘
```

## 3. The backend repo (`cdm-backend`)

New repo, organized by domain module — each module owns its routes, business rules, and DB access; nothing outside a module touches its tables directly:

```
cdm-backend/
  src/
    modules/
      auth/           youth phone+OTP auth, admin login, session/JWT issuance
      youths/         profiles, cdm_id issuance
      events/         RSVP, duty assignment, check-in, notification fan-out
      uniforms/       order lifecycle, stock, production tracking
      formation/      content library, uploads
      welfare/        cases
      mission/        nominations, tracking
      notifications/  fan-out + delivery (SMS/M-Pesa integration point)
      reports/        cross-domain aggregation
    db/               schema, migrations, query layer
    http/             route wiring, auth middleware, validation
  supabase/ (or db/)  migrations (moved here from the frontend repos)
```

Splitting a domain into its own microservice later means extracting one `modules/<x>` folder plus its DB tables — the module boundary is designed to make that mechanical, not a redesign.

## 4. Concrete technical choices

| Decision | Recommendation | Rationale |
|---|---|---|
| **Database** | Keep Postgres. Hosting can stay on Supabase-managed Postgres, or move to Neon/RDS/etc. later — this is a separate, low-stakes decision. | No need to migrate data; only *who is allowed to connect* changes. |
| **ORM / query layer** | Drizzle | TypeScript-first, stays close to raw SQL, lightweight migrations, no heavy runtime. |
| **API style** | REST + OpenAPI spec, with a generated TypeScript client consumed by each frontend repo | All current frontends are TypeScript, but a future native app is plausible — OpenAPI keeps the contract language-agnostic while still giving typed clients today. (tRPC would have slightly less ceremony, but permanently ties every future client to TypeScript.) |
| **Auth** | Keep Supabase Auth, but only the backend ever calls it. Frontends authenticate against the backend's own `/auth/*` endpoints and receive a backend-issued session/JWT. | The phone/OTP registration and login flows are already built and tested this session — rebuilding auth from scratch buys nothing. This satisfies "no direct DB/service access from frontends" without discarding working code. |
| **File storage** | Keep Supabase Storage; backend issues signed upload/download URLs on request | Same reasoning as auth — proven, just re-gated behind the backend instead of being called straight from the browser. |
| **Row Level Security (RLS)** | Turn off reliance on RLS for authorization once the backend is the sole DB client | With one trusted service holding the only DB connection, RLS becomes a second copy of authorization logic that's easy to forget to update — which is exactly the drift bug hit this session. Authorization moves into backend middleware/module code, where it's testable and in one place. |
| **Backend hosting** | A persistent-connection host (Railway, Render, Fly.io, or similar) | Cloudflare Workers are edge isolates — a poor fit for a service holding a Postgres connection pool. Frontends can remain on Cloudflare Pages/Workers since they'll only be making outbound HTTP calls to the backend. |

## 5. Migration path — strangler fig, not a rewrite

The system is live and working; nothing here should be a big-bang cutover.

1. **Scaffold `cdm-backend`** with one pilot domain: **uniforms**. Its lifecycle logic is already the most self-contained and most recently built (`src/lib/db/uniform-sales.ts`, `src/lib/db/uniform-stock-entries.ts`), so it ports with the least ambiguity.
2. **Point the admin Uniforms page at the new API** for that one domain only. Every other page keeps using direct Supabase calls, unchanged. Verify side by side.
3. **Repeat per domain**, in roughly this order: events → formation → welfare → mission → youths → notifications. Each step is independently shippable and revertible.
4. **Once every domain is migrated off direct Supabase access**, split `apps/admin` and `apps/youth-portal` out into their own repos — by this point they carry no DB-shaped code, just an API client.
5. **Only if a domain later outgrows the monolith** (throughput, dedicated team ownership, independent scaling needs) — peel it into its own service with its own datastore. Not a day-one concern.

## 6. What does *not* change

- Postgres schema and existing data — untouched by this migration; only the access path changes.
- Supabase Auth's phone/OTP flows and Storage buckets — reused, just re-gated behind the backend.
- The diocese's org structure (deaneries/parishes/outstations), youth records, event/uniform/formation/welfare/mission data — all carried over as-is.

## 7. Open decisions before implementation starts

These are called out explicitly because they're genuinely judgment calls, not things to default silently:

1. **Framework for `cdm-backend`** — e.g. Hono, Fastify, or NestJS. (Leaning Hono/Fastify for a modular monolith of this size; NestJS if more structure/DI conventions are wanted as the team grows.)
2. **Timing** — whether to start the uniforms pilot now, or sequence it after the remaining Youth Portal feature work (event RSVP dialog, uniform order rework on the portal side, formation plain-text option, end-to-end verification).
3. **Repo hosting/ownership** — where `cdm-backend` and the eventually-split frontend repos live (same GitHub org, naming convention, CI setup).

## 8. Non-goals (explicitly out of scope for this proposal)

- Microservices — not being introduced now; the modular-monolith boundary is what makes it *possible* later.
- Rebuilding auth, storage, or the database engine — all reused as-is.
- Any change to the mobile-web/PWA decision, or the phone-number-based identity model for the youth portal — both already decided and unaffected by this proposal.
