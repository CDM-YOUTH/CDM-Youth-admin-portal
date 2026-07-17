# Security, Hosting & Go-Live Plan — Current vs Proposed Architecture

Status: **For review — informs the decision in [backend-architecture-proposal.md](./backend-architecture-proposal.md)**
Date: 2026-07-17

This document answers three questions: how secure is what we have vs. what's proposed, what hosting is required and roughly how much it costs (KES), and what's actually required to go live under each architecture. Domain: not yet confirmed which registrar/DNS provider manages it — both scenarios are covered in §4.

## 1. Security — current state (audited, not assumed)

A code-level audit of both apps and all migrations found:

### Solid today
- **Passwords**: fully delegated to Supabase Auth (bcrypt under the hood). No app code ever touches or stores a password.
- **OTP codes**: hashed at rest with SHA-256 before being written to `otp_codes.code_hash` — plaintext only ever goes out over SMS, never persisted.
- **OTP expiry**: 10-minute TTL, enforced.
- **Service-role key**: confirmed to appear only in server-only files (`client.server.ts` in each app, plus ops scripts). Never referenced in any browser-bundled file.
- **RLS on sensitive tables**: `welfare_cases` correctly restricts to staff-full-access + self-insert/self-read-own (no self-update/delete — a youth can't alter or erase their own case, which is the right default for this kind of record). `otp_codes` has zero anon/authenticated policies (correctly service-role-only).

### Gaps found — recommend fixing before go-live, regardless of which architecture ships

| Gap | Where | Risk | Fix effort |
|---|---|---|---|
| **OTP brute-force is unthrottled** | `apps/youth-portal/src/rpc/auth.ts` — an `attempts` counter is incremented on each failed OTP check but **never read or enforced anywhere** | An attacker who intercepts/guesses can try all 1,000,000 combinations of a 6-digit code within the 10-minute window, unthrottled. This is the highest-priority fix in this whole document. | Small — add `if (attempts >= 5) reject` before checking the code |
| **No cooldown on OTP requests** | same file, `requestPasswordReset` | Nothing stops spamming SMS sends to one phone number, or using it to run up SMS provider costs / harass a number | Small — add a per-phone cooldown (e.g. 60s between sends, max N per hour) |
| **No rate limiting anywhere** | registration, login, OTP request — across both apps | Credential-stuffing / scripted signup abuse has no friction at all today | Medium — needs either app-level throttling or a proxy/WAF rule |
| **Root `.env` is committed to git** | repo root `.env` | Contains only the anon/publishable key + project ref (not a secret leak per se — anon keys are meant to be public), but committing env files at all is a bad habit that risks a real secret landing there later | Small — add to `.gitignore`, move real values to Cloudflare env vars |
| **CORS / Auth Site URL** | Supabase dashboard, not in code | Unverifiable from the repo — needs manual confirmation that Site URL / redirect URLs are locked to production domains before launch, not left on a wildcard/dev value | N/A — dashboard check |

None of these require the backend migration to fix — they're fixable in the current architecture this week.

### Security comparison: current vs proposed

| | Current (direct Supabase + RLS) | Proposed (dedicated backend) |
|---|---|---|
| **Who enforces authorization** | Postgres RLS policies, duplicated logic per table | Backend application code, one place, testable |
| **Attack surface for a bug** | Any missed/misconfigured RLS policy = a live data leak (we already found one stale-drift incident this session) | A bug in backend code is still bad, but it's one codebase under CI/tests instead of N scattered SQL policies |
| **Where secrets can leak from** | Only the anon key is ever client-side (by design, low risk); service-role key already confirmed contained | Same — service-role-equivalent credential lives only in the backend, never shipped to any frontend |
| **Rate limiting / abuse control** | Nowhere to put it today except inside each frontend (awkward, easy to skip — as we found) | Natural home: backend middleware, applied once, covers every frontend automatically |
| **New surface introduced** | None | The backend itself becomes a single point of failure/attack — must be patched, monitored, and given its own auth to Postgres/Supabase. This is a real trade, not a pure win. |
| **Blast radius of a breach** | A leaked anon key + RLS bug exposes whatever that policy exposes | A compromised backend has broad DB access by design (it's the trusted tier) — makes hardening *that one service* (patching, secrets rotation, logging, least-privilege DB role) more important, not less |

**Bottom line**: the proposed architecture doesn't make the system inherently "more secure" — it relocates where security has to be enforced, to a place that's easier to test and harder to forget (one codebase vs. N ad hoc RLS policies). The concrete gaps above (OTP brute force, rate limiting, committed `.env`) exist *today* and should be fixed regardless of which architecture you're on.

## 2. Hosting — what's required, and roughly how much (KES)

Figures below are approximate USD list prices converted at ~KES 130/USD, rounded — check current provider pricing before budgeting, and treat this as a planning estimate, not a quote.

### Current architecture

| Item | Provider | Plan needed for production | Est. cost |
|---|---|---|---|
| Frontend hosting (admin + youth portal) | Cloudflare Pages/Workers | Free tier likely sufficient at this traffic; Workers Paid if you exceed free-tier request limits | KES 0–650/mo |
| Database + Auth + Storage | Supabase | **Pro plan recommended** — free tier pauses the project after a week of inactivity and has tighter storage/bandwidth caps, both unacceptable for a live system | ~KES 3,250/mo ($25) |
| Domain | Existing registrar | Already owned — renewal cost unaffected by this project | Sunk cost, not new spend |
| SSL/TLS | Cloudflare / Let's Encrypt | Free, automatic | KES 0 |
| SMS (OTP, notifications) | Africa's Talking (already the assumed provider) | Pay-per-SMS, no monthly fee; production requires business verification for a sender ID | ~KES 0.80–1/SMS + one-time sender-ID registration (varies) |
| M-Pesa (when enabled) | Safaricom Daraja | Sandbox is free; production needs a registered paybill/till from Safaricom directly — setup cost and per-transaction charges are Safaricom's own pricing, not something hosting covers | Variable — confirm directly with Safaricom |
| Source control / CI | GitHub | Free tier (private repos + Actions minutes) sufficient at this team size | KES 0 |
| **Total new recurring infra spend** | | | **~KES 3,250–3,900/mo**, plus per-SMS and per-M-Pesa-transaction costs that scale with usage |

### Proposed architecture — additional on top of the above

| Item | Provider | Est. cost |
|---|---|---|
| Backend service hosting | Railway, Render, or Fly.io (persistent Node process) | ~KES 900–3,250/mo ($7–25), depending on instance size |
| Error monitoring (optional but recommended once there's a single backend to watch) | Sentry | Free tier sufficient at this scale |
| Postgres | Still Supabase Pro (already counted above) — backend connects with a direct/pooled connection string instead of via `supabase-js` | No new DB cost |

**Total additional spend for the proposed architecture: roughly KES 900–3,250/month.** Everything else (Supabase, Cloudflare, SMS, M-Pesa) is shared between both architectures since the proposal keeps Supabase Auth/Storage and Postgres — it only adds one new hosted service.

## 3. What's required to go live — current vs proposed

**Key point: the current architecture can go live now. The backend migration is a parallel improvement track, not a launch blocker.** Nothing in the proposed architecture is required to ship — you can launch on the current setup with the fixes below, then migrate underneath it domain-by-domain per the strangler-fig plan, with zero downtime.

### To go live on the current architecture

1. Upgrade Supabase to the Pro plan (stop the free-tier pause risk, get daily backups).
2. Fix the OTP brute-force gap and add an OTP-request cooldown (§1) — small, should not be skipped.
3. Add basic rate limiting to registration/login endpoints, even a simple per-IP/per-phone cooldown.
4. Stop tracking `.env` in git going forward; move production values to Cloudflare's environment variable settings.
5. Confirm (in the Supabase dashboard) that Auth Site URL / redirect URLs are locked to your real production domains, not a dev/wildcard value.
6. Point `admin.<domain>` and `portal.<domain>` (or `app.<domain>`) at the Cloudflare Pages/Workers deployments (§4).
7. Start the Africa's Talking sender-ID business-verification process early — it's not instant.
8. Decide: launch with M-Pesa still stubbed (manual confirmation, as today) or start the Safaricom paybill/till application now, since that's a business process with its own timeline outside your control.
9. Flag for a compliance/legal check (not something I can do for you): the youth portal collects personal data on minors and handles sensitive welfare records — worth confirming registration obligations under Kenya's Data Protection Act 2019, and whether a basic privacy notice/consent step is needed before collecting data from under-18s.
10. Basic uptime monitoring (even a free UptimeRobot check on both domains) so an outage doesn't go unnoticed.

### Additionally required before the proposed architecture can carry production traffic

(Not needed for launch — needed once you've migrated a given domain off direct Supabase access, per the migration path in the architecture proposal.)

1. `cdm-backend` deployed on a persistent host (Railway/Render/Fly).
2. `api.<domain>` pointed at that host, CORS locked to only the `admin.` and `portal.` origins.
3. Auth bridge working end-to-end (frontends hit the backend's `/auth/*`, backend calls Supabase Auth admin API) — tested before any frontend route is cut over.
4. Rate limiting and the OTP lockout fix implemented once, in the backend, rather than patched per-frontend.
5. Logging/monitoring for the new service (Sentry or the host's built-in logs) — it's now a single point of failure for both apps, so visibility matters more than it did when there was no shared service.

## 4. Domain & subdomain plan

You mentioned the domain is owned but you're not yet sure who manages its DNS. Both cases below lead to the same subdomain layout — only the *how* differs.

**Planned subdomains** (replace `<domain>` with the real one once confirmed):
- `admin.<domain>` → Admin portal
- `portal.<domain>` (or `app.<domain>`) → Youth portal (mobile PWA)
- `api.<domain>` → Backend API — only needed once the proposed architecture is live, not for current-architecture launch
- `<domain>` / `www.<domain>` → reserved for the future public youth website

**If DNS turns out to already be on Cloudflare**: no action needed beyond adding the subdomain records in the same Cloudflare dashboard already used for Pages/Workers — a few minutes, no propagation risk, no cost.

**If DNS is managed elsewhere** (GoDaddy, Namecheap, the registrar's own panel, etc.), there are two valid paths — worth deciding once you hear back from the diocese's tech lead:
- **Option A — leave DNS where it is**: add CNAME/A records for `admin`/`portal`/`api` at that registrar pointing to the Cloudflare-provided hostnames for each deployment. Fully workable, just means DNS and hosting live in two different dashboards.
- **Option B — move nameservers to Cloudflare** (free): consolidates DNS, hosting, and SSL into one place, which tends to be less error-prone long-term and is what I'd default to if there's no strong reason to stay put. Takes a nameserver change at the current registrar (needs whoever has admin access there) and 24–48 hours to propagate; no downtime if the old records are mirrored before the cutover.

Either way, this step needs the actual domain name and confirmation of who currently controls its DNS before I can give literal record values — flag me once you've talked to the tech lead and I'll write out the exact records to add.
