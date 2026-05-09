## Goal

Replace all mock data with a real Lovable Cloud (Postgres) backend so every page — dashboard, youth records, enrollment, CUSA, events, check-in — reads and writes real data, and CSV imports parse and insert real rows.

## 1. Enable Lovable Cloud

Provision the backend (Postgres + auth + storage). All schema changes go through migrations.

## 2. Database schema (migrations)

Reference tables (seeded once from existing `ORGANIZATION` mock):
- `deaneries` (id, code, name)
- `parishes` (id, deanery_id, name)
- `outstations` (id, parish_id, name)

Core tables:
- `youths` — cdm_id (unique, auto), full_name, gender, age, phone, alt_phone, email, deanery_id, parish_id, outstation_id, category, institution, year_of_study, notes, status, created_at
- `enrollments` — youth_id, year (2026), payment_ref, amount, status, created_at
- `cusa_members` — youth_id, institution, course, year_of_study, leadership_role, created_at
- `events` — name, date, venue, organization_level, deanery_id, parish_id, created_at
- `event_program_items` — event_id, start_time, end_time, activity, order
- `event_duty_categories` — event_id, name, order
- `event_duties` — category_id, title, fields(jsonb)
- `event_duty_assignees` — duty_id, deanery_id, parish_id, name
- `event_checkins` — event_id, youth_id (nullable), guest_name, guest_phone, checked_in_at, method

RLS: enable on all tables. For now (single admin app) allow authenticated read/write; add `user_roles` table + `has_role` security-definer fn for future admin gating.

Seed migration loads ORGANIZATION + a sample of YOUTH_REGISTRY so the dashboard isn't empty.

## 3. Server functions (`src/lib/*.functions.ts`)

- `youths.functions.ts` — list (with filters), create, update, delete, bulkInsert (CSV)
- `enrollments.functions.ts` — list, create, bulkInsert (CSV w/ shared payment ref)
- `cusa.functions.ts` — list, create, update, delete
- `events.functions.ts` — list, get, upsert (3-tab payload), addCheckin, listCheckins
- `analytics.functions.ts` — dashboard aggregates (totals, by deanery/parish/category, enrollment rate)
- `org.functions.ts` — load deaneries/parishes/outstations for cascading selects

All use `supabaseAdmin` (single-admin app); switch to `requireSupabaseAuth` once auth is added.

## 4. Frontend wiring

Replace mock-data imports with `useQuery` calls to server fns:
- `admin.index.tsx` — dashboard tiles & charts from `analytics.functions`
- `admin.youths.tsx` — table + Register/Edit/Delete/Enroll all hit DB; CSV import parses with PapaParse and calls `bulkInsert`
- `admin.enrollment.tsx` — same pattern; bulk-payer CSV applies one ref to many cdm_ids
- `admin.cusa.tsx` — wire Add Member to `cusa.create`
- `admin.events.tsx` / `admin.event.$eventId.tsx` — Save tab calls `events.upsert` with the full nested payload (program items, duty categories, duties, assignees)
- `checkin.$eventId.tsx` — search hits `youths.search`; check-in calls `events.addCheckin`
- Cascading filter `<select>` options come from `org.functions` (cached)

CSV parsing via `papaparse` (`bun add papaparse`).

## 5. Validation & errors

Zod schemas shared between client form and server `inputValidator`. Toast on success/error. Optimistic updates where safe; otherwise invalidate the relevant query.

## 6. Out of scope this round

- Admin login/auth UI (will add `_authenticated` layout in a follow-up)
- File-upload storage for event posters
- Email/SMS notifications

## Technical notes

- One migration creates all tables + RLS + seed
- One migration backfills reference data from existing mock ORGANIZATION
- React Query is already used elsewhere; add `QueryClientProvider` to `__root.tsx` if not present
- Keep `mock-data.ts` as a fallback only for seed generation
