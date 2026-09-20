# 🍽 Office Employee Meal & Cost Management System

A production-grade web application for managing daily office lunch responses,
serving/consumption tracking, meal pricing (with immutable history), employee
payments, monthly settlement, and full reporting (Excel/PDF) — built for a
single organization's HR/Admin team and its employees.

> **Honesty note (please read):** this codebase was generated in an
> environment with no internet access, so it could not be `npm install`-ed,
> built, or run here to verify it compiles end‑to‑end. The code follows
> well‑established, standard APIs (Next.js App Router, Prisma, ExcelJS,
> PDFKit) and every business calculation is written and documented
> carefully, but you should follow **Local Setup** below and treat first run
> as your own verification step. If something doesn't compile, it is almost
> certainly a small, easy-to-fix mismatch (a Prisma type name, an import
> path) — see **Troubleshooting** at the bottom.

---

## 1. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend + Backend | **Next.js 14** (App Router, TypeScript) | One codebase, deploys to Vercel free tier natively, API routes = backend |
| Database | **PostgreSQL** | Relational integrity for financial data; free tier available on Neon/Supabase |
| ORM | **Prisma** | Type-safe queries, migrations, easy to read schema |
| Auth | JWT in an httpOnly cookie + bcrypt | Simple, no external auth service dependency, works on Vercel serverless |
| Styling | Tailwind CSS | Fast, consistent design system |
| Excel export | ExcelJS | Real `.xlsx` generation, styled headers, auto-filter |
| PDF export | PDFKit | Real `.pdf` generation, tables, print-friendly |
| Charts | Recharts (wired for dashboard extension) | Composable React charts |

---

## 2. Changelog

**v1.3**:
- **Cleaned up noisy (but harmless) build-log errors.** During `npm run build`, Next.js's static-generation check throws an internal `DYNAMIC_SERVER_USAGE` signal for every route that uses `cookies()` — expected and correct for an authenticated app, and the build already completed successfully and marked every such route dynamic (`ƒ`) either way. However, this app's own `withRoute()` error wrapper (and the two export routes' manual try/catch) was catching that internal signal indiscriminately and logging it as `"Unhandled API error"`, which looked alarming in build output even though nothing was actually broken. All three now explicitly detect and re-throw Next.js's own control-flow errors (`DYNAMIC_SERVER_USAGE`, `NEXT_REDIRECT`, `NEXT_NOT_FOUND`) instead of swallowing them, so a clean build produces a clean log.

**v1.2** (this delivery):
- **Fixed 4 Vercel build failures** reported after deploying v1.1, with root causes addressed (not just patched):
  - `react/no-unescaped-entities` — fixed every raw `'`/`"` inside JSX text across the app (curly quotes or a JS-string wrapper), including one extra instance the report didn't catch
  - `Shell.tsx` role type mismatch — now imports Prisma's actual `Role` type instead of a hand-rolled 3-value union. Doing this surfaced a **real bug**: a `CATERING`-role account would have infinite-redirect-looped between `/login` and `/admin/dashboard`, since that role has no page. Fixed with a shared `homeFor()` helper and a new `/pending-access` page for any role without a built portal
  - `Buffer`/`Response` type error in the Excel export route — applied `new Uint8Array(buffer)`, and also applied the identical fix to the **PDF** export route, which had the same issue but wasn't in the original report
  - `formatCurrency()` didn't accept Prisma `Decimal` — widened its type to `number | string | Prisma.Decimal`
- **Mobile: proper hamburger menu.** `Shell.tsx` rewritten with a real slide-in drawer (backdrop, closes on navigation, locks background scroll) instead of a bottom tab bar. Every table now scrolls horizontally within its own card on narrow screens instead of clipping (`overflow-x-auto`), filter/search inputs go full-width on mobile, and modals (Add Employee, Record Payment, confirmation dialogs) cap their height and scroll internally so they never get cut off on short screens.
- **Every account can change its own password** — `POST /api/auth/change-password` (re-verifies the current password, audited) plus a `/account/password` page linked from the sidebar for every role.
- **Calendar & Holidays page** (`/admin/calendar`, shared by HR and Super Admin — previously Super-Admin-only): set the company's standing weekly working-day pattern (applies to every month automatically) and block/unblock specific dates. Blocking a date (Holiday) still cascades to cancel that date's responses and un-charge consumption, as in v1.1; the page now also supports removing an entry and makes the "office closed vs. opens specially" distinction explicit in the copy.
- **Color-coded action buttons.** Added `btn-success` (green), `btn-warning` (amber), `btn-info` (blue), `btn-purple` (violet), and outline variants to the design system, and applied them by intent across the app: Excel exports are green, PDF exports are purple, "take/mark served"-type actions are green, "cancel/void/deactivate"-type actions are red, "recompute" is blue — so the action a button performs is visually obvious at a glance, not just from its label.

**v1.1**:
- Bumped Next.js to `^14.2.25` — the earlier `14.2.15` pin had known, since-patched
  security advisories (including a middleware authorization bypass); the caret
  range means `npm install` always pulls the latest patched 14.2.x.
- **Plan-the-whole-month meal responses.** Employees can tap "Set Whole Month"
  on the dashboard to mark every remaining working day as "Taking Lunch" in
  one action, then cancel any individual future day from the new "This
  Month's Lunch Plan" list — each day stays editable up until *that day's*
  own cutoff, not just today's (`POST /api/meal-response/monthly`,
  `GET /api/meal-response/range`, and `POST /api/meal-response` now accepts
  any future date instead of only today).
- **Configurable working days + office-closed dates.** Added an `OrgSetting`
  key/value table (`GET/PATCH /api/settings/working-days`) so the weekly
  pattern (default Sun–Thu) isn't hardcoded. Marking a date a **Holiday**
  under Settings now cascades: it auto-cancels every employee's response for
  that date, un-charges any consumption already recorded, and recomputes the
  affected settlements — so "office is closed this day" reliably means
  nobody is charged for a meal that day, no manual cleanup needed.
- **Fixed: HR/Admin clicking "Settings" appeared to silently fail.** Settings
  and Audit Log are Super-Admin-only pages, but the sidebar was showing them
  to HR/Admin too, so clicking them triggered a real (correct) redirect that
  looked like a bug. The sidebar now only shows those two links to Super Admin.
- **Fixed: pages felt slow / stuck on "Loading…" repeatedly.** Every page
  was a client component that first fetched `/api/auth/me` to check who was
  logged in *before* rendering anything, so every navigation showed a loading
  flash for auth, then another for the page's own data. All pages are now
  Server Components that resolve the session on the server (zero extra
  round-trip, nothing to flash) and hand it down to a client component as a
  prop. The heavier list/table pages (Daily Roster, Employees, Payments,
  Settlement, Audit, Reports, My Meals, HR Dashboard) also now show proper
  skeleton placeholders instead of blank tables while their data loads.

## 3. What's included vs. simplified (read this before judging "completeness")

The original spec (60 sections) describes a multi-week enterprise build.
This delivery implements the **entire financial and operational core** for
real — nothing here is a fake button — but the following were intentionally
**scoped down or deferred** so that what exists is genuinely correct rather
than broadly fake:

**Fully implemented, real, server-calculated:**
- Auth + RBAC (Super Admin / HR-Admin / Employee / Catering enum ready)
- Employee & Department CRUD, soft-deactivate (never hard-deletes history)
- Configurable meal types, enable/disable, cutoff time, **immutable price
  history** (effective-dated, prevents overlaps)
- Daily meal response with **server-enforced cutoff** and idempotent upsert
  (network retries never duplicate a response)
- Serving/consumption tracking, separate from response, bulk update
- Server-side meal cost calculation (frontend never sends a charge amount)
- Payments (create, void-with-reason, audited), searchable employee picker
- Monthly settlement engine: previous outstanding → this month's cost →
  payments → outstanding/credit/status, exactly as specified in section 13
- Reports: Daily / Monthly / Department / Employee bill — all four are
  **downloadable as both Excel and PDF**, using the *same* data functions the
  on-screen tables use (so numbers always reconcile)
- Audit log for all financial/critical actions (price change, payment
  void, serving override, employee deactivate, etc.)
- Search + filter + server-side pagination on every large table
- Monthly meal planning: employees can bulk-set a whole month to "Taking
  Lunch" and cancel individual future days any time before that day's own
  cutoff; configurable working-week pattern; marking a date a Holiday
  cascades to cancel that day's responses and un-charge consumption
- Seed script with 20 employees, realistic Sept 2026 meal history, a real
  price change (Sep ৳100 → Oct ৳110), and all four payment states

**Deferred (architecture supports adding later, not built this round):**
- SMS/WhatsApp/email notification delivery (the data model has everything
  needed; no delivery integration was wired up)
- A dedicated Catering vendor UI (the `CATERING` role and read-only roster
  data model exist; no separate screen was built)
- CSV/Excel *employee import* UI (single-employee create form exists;
  bulk import endpoint was not built)
- An automated test suite (section 48's test list is documented as a
  **manual QA checklist** in `TESTING.md` instead of Jest/Playwright code)
- "Finalize month" lock UI (the `isFinalized` field and guard exist in
  `settlement.ts`, but there's no button for it yet — recompute always
  works safely because finalized months are protected in code)

If you need any of these, they're a normal follow-up increment on top of
this codebase, not a rewrite.

---

## 4. Business Rules (the parts that must never be "wrong")

**Meal cost.** A meal is only chargeable when its serving status is `SERVED`
or `EXTRA` (configurable per meal type via `chargeOnServedOnly`). An
employee who said "yes" but wasn't actually served is **not** charged.

**Price history.** Prices are never overwritten. Setting a new price closes
the previous open period the day before the new `effectiveFrom`. A meal's
`unitPriceApplied` and `chargeAmount` are captured **once, at the moment
serving status is set**, and never recalculated afterward — so changing
today's price never rewrites last month's bills.

**Settlement math** (per employee per month):
```
previousOutstanding = last month's (outstanding − credit), floored at 0
net = mealCost + previousOutstanding − paymentsThisMonth
if net < 0:  outstanding = 0,        credit = −net   → OVERPAID
if net == 0: outstanding = 0,        credit = 0       → PAID
if net > 0 and some payment made:    → PARTIALLY_PAID
if net > 0 and no payment made:      → UNPAID
```

**Cutoff.** Enforced server-side in `/api/meal-response` (see
`src/lib/dates.ts#isPastCutoff`), not just in the UI countdown. A request
arriving after the configured cutoff time (organization timezone) is
rejected with `409 CUTOFF_PASSED` regardless of what the client thinks the
time is.

**Never hard-delete.** Departments and employees are deactivated, not
deleted, once they have any historical record — this preserves report
consistency permanently.

**Payments are reversed, not edited.** Voiding a payment sets
`status = VOIDED` and requires a reason; the original amount/date/method
stay on the row forever. Settlement totals exclude voided payments.

---

## 5. Roles & Permission Summary

| Action | Super Admin | HR/Admin | Employee |
|---|---|---|---|
| Manage employees/departments | ✅ | ✅ (employee accounts only) | ❌ |
| Create HR/Admin/Catering accounts | ✅ | ❌ | ❌ |
| Configure meal types / cutoff / enable-disable | ✅ | ❌ | ❌ |
| Set meal price | ✅ | ❌ | ❌ |
| Set weekly working-day pattern / block-unblock dates | ✅ | ✅ | ❌ |
| Submit / modify own meal response (incl. plan-the-month) | — | — | ✅ (per-day, before that day's cutoff) |
| Mark serving status | ✅ | ✅ | ❌ |
| Record / void payments | ✅ | ✅ | ❌ |
| View all employees' financials | ✅ | ✅ | ❌ (own only) |
| View own meals/payments/bill | — | — | ✅ |
| Change own password | ✅ | ✅ | ✅ |
| View audit log | ✅ | ❌ | ❌ |
| Export reports (Excel/PDF) | ✅ | ✅ | ✅ (own bill only) |

---

## 6. Database Schema (ERD, text form)

```
Department 1───* Employee 1───1 User
MealType 1───* MealPriceHistory
MealType 1───* MealResponse *───1 Employee
MealType 1───* MealConsumption *───1 Employee
MealPriceHistory 1───* MealConsumption   (immutable price snapshot)
Employee 1───* Payment
Employee 1───* Settlement  (one row per employee per "YYYY-MM")
User 1───* AuditLog
CalendarException (holidays / special working days, standalone)
```

Full field-level definitions are in [`prisma/schema.prisma`](./prisma/schema.prisma)
— it is the single source of truth and is commented section-by-section.

Key constraints:
- `MealResponse` and `MealConsumption` each have a
  `@@unique([employeeId, mealTypeId, date])` constraint — the database
  itself refuses a duplicate, so a retried network request can never create
  two rows (all writes to these tables use Prisma `upsert`).
- `Settlement` has `@@unique([employeeId, settlementMonth])`.
- `MealPriceHistory` periods are prevented from overlapping in application
  code (`src/lib/pricing.ts#setMealPrice`), inside a transaction.

---

## 7. API Overview

All endpoints return `{ success, message, data? , code? }`. Errors use
appropriate HTTP status codes (`401`, `403`, `404`, `409`, `422`, `500`).

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Login, sets httpOnly session cookie |
| POST | `/api/auth/logout` | Clears session |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/departments` | List / create departments |
| PATCH/DELETE | `/api/departments/:id` | Update / deactivate |
| GET/POST | `/api/employees` | List (search/filter/paginate) / create |
| GET/PATCH | `/api/employees/:id` | View / update / (de)activate |
| GET | `/api/meal-types` | List meal types + current price |
| PATCH | `/api/meal-types/:id` | Enable/disable, cutoff, rules |
| GET/POST | `/api/meal-types/:id/price` | Price history / set new price |
| GET | `/api/meal-response/today` | Today's status for logged-in employee |
| POST | `/api/meal-response` | Submit/modify a response for today or any future date (cutoff enforced per-date) |
| POST | `/api/meal-response/monthly` | "Set Whole Month" bulk plan (skips holidays/weekends/explicit cancellations) |
| GET | `/api/meal-response/range` | Per-day status across a date range, for the "This Month's Plan" list |
| GET/POST | `/api/serving` | Daily roster / bulk mark serving status |
| GET/POST | `/api/payments` | List (search/filter/paginate) / record |
| POST | `/api/payments/:id/void` | Void with required reason |
| GET/POST | `/api/settlement` | Monthly table / recompute |
| GET/POST | `/api/holidays` | List / add calendar exceptions (adding a HOLIDAY cascades: cancels that date's responses & un-charges consumption) |
| DELETE | `/api/holidays/:id` | Remove a calendar exception |
| GET/PATCH | `/api/settings/working-days` | View / set which weekdays count as working days (Super Admin & HR/Admin) |
| POST | `/api/auth/change-password` | Any authenticated account changes its own password |
| GET | `/api/reports/daily` \| `monthly` \| `department` | Report JSON |
| GET | `/api/reports/employee/:id` | Employee bill JSON |
| GET | `/api/export/excel?report=...` | Excel download (daily/monthly/department/employee-bill) |
| GET | `/api/export/pdf?report=...` | PDF download (same report types) |
| GET | `/api/audit` | Audit log (Super Admin only) |
| GET | `/api/dashboard/hr` \| `/api/dashboard/employee` | Dashboard summaries |

---

## 8. Local Setup

### Prerequisites
- Node.js 20+
- Docker (optional, for local Postgres) — or any Postgres 14+ instance

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Start a local Postgres (or point DATABASE_URL at one you already have)
docker compose up -d

# 3. Configure environment
cp .env.example .env
# edit .env: set JWT_SECRET to a random string, e.g.
openssl rand -base64 48

# 4. Create the database schema
npm run prisma:migrate -- --name init

# 5. Seed realistic demo data (20 employees, Sep/Oct 2026 price change, etc.)
npm run seed

# 6. Run the app
npm run dev
```

Open http://localhost:3000 — you'll land on `/login`.

**Demo logins (from the seed script):**
| Role | Email | Password |
|---|---|---|
| Super Admin | `superadmin@company.com` | `SuperAdmin@123` |
| HR/Admin | `hr@company.com` | `HrAdmin@123` |
| Employee | any seeded email, e.g. `rahim.islam0@company.com` | `Employee@123` |

> Change every demo password before using this anywhere near real data.

---

## 9. Deploying to Vercel (free tier, step by step)

**8.1 — Push this project to GitHub** (Vercel deploys from a Git repo).
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-empty-github-repo-url>
git push -u origin main
```

**8.2 — Create a free Postgres database.** Vercel's own free Postgres
(via the "Storage" tab, Neon-backed) or https://neon.tech directly both work
with no credit card. Create a database and copy its **pooled** connection
string (it usually looks like
`postgresql://user:pass@ep-xxxx-pooler.region.aws.neon.tech/dbname?sslmode=require`).

**8.3 — Import the project into Vercel.**
1. Go to https://vercel.com/new, sign in with GitHub, select your repo.
2. Framework preset: Vercel auto-detects **Next.js** — leave defaults.
3. Before clicking Deploy, open **Environment Variables** and add:
   - `DATABASE_URL` = the Neon/Vercel Postgres connection string from 8.2
   - `JWT_SECRET` = a long random string (`openssl rand -base64 48`)
   - `ORG_TIMEZONE` = `Asia/Dhaka` (or your org's timezone)
   - `CURRENCY_SYMBOL` = `৳`
4. Click **Deploy**.

**8.4 — Run the migration against the production database** (one-time, from
your own machine — Vercel doesn't run migrations automatically):
```bash
# In your local .env, temporarily point DATABASE_URL at the SAME
# Neon/Vercel Postgres URL from step 8.2, then:
npm run prisma:deploy
npm run seed          # optional — only if you want demo data in production
```

**8.5 — Done.** Your app is live at `https://<project>.vercel.app`. Every
subsequent `git push` to `main` redeploys automatically.

**Notes for the free tier:**
- Vercel's Hobby (free) plan is sufficient for this app's traffic (150–500
  employees). Serverless function execution time and Postgres connection
  limits are the two things to watch as you scale — Prisma's connection
  pooling via the "pooled" Neon URL handles this correctly.
- PDFKit/ExcelJS run fine in Vercel's Node.js serverless runtime (already
  configured via `serverComponentsExternalPackages` in `next.config.js`).

---

## 10. Project Structure

```
prisma/
  schema.prisma        — full data model (see comments per section)
  seed.ts               — demo data generator
src/
  lib/
    db.ts                — Prisma client singleton
    auth.ts              — JWT session, password hashing
    dates.ts              — timezone-aware date helpers, cutoff logic
    api.ts                — requireRole/ApiError/withRoute helpers
    audit.ts              — audit log writer
    pricing.ts            — price history logic (the "never overlap" rule)
    consumption.ts        — serving status → charge calculation
    settlement.ts         — the monthly settlement accounting engine
    reports.ts            — shared report-data functions (used by UI + export)
    validation.ts         — all zod input schemas
    export/excel.ts, pdf.ts — report file builders
  components/            — Shell, SearchableSelect, DataTable bits, etc.
  app/
    login/, dashboard/, my-meals/        — employee-facing pages
    admin/                                — HR/Admin/Super-Admin pages
    api/                                  — all backend route handlers
```

---

## 11. Troubleshooting

- **"Cannot find module '@prisma/client'"** — run `npm install` then
  `npx prisma generate` (also runs automatically via `postinstall`).
- **"No meal price is configured for this date"** — an admin must add a
  price under Settings → Meal Pricing before any serving status can be
  marked `SERVED`/`EXTRA` for that date.
- **Cutoff seems off by a few hours** — check `ORG_TIMEZONE` in `.env`;
  all cutoff/holiday logic is anchored to that timezone, not server local
  time or UTC.
- **Prisma decimal math looks like `"100.00"` strings in the API** — this is
  expected; `Decimal` fields serialize as strings over JSON so no precision
  is lost. The frontend calls `Number(...)` before formatting for display.

---

## 12. Security Checklist Before Going Live

- [ ] Rotate `JWT_SECRET` and every seeded demo password
- [ ] Put the app behind HTTPS (Vercel does this by default)
- [ ] Restrict the Postgres instance to accept connections only from Vercel
- [ ] Review `src/lib/api.ts#requireRole` usage on any new route you add —
      every route must call it; there is no global middleware gate
- [ ] Set up regular Postgres backups (Neon/Vercel Postgres both offer this
      on paid tiers; export critical tables periodically otherwise)
