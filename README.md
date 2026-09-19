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

## 2. What's included vs. simplified (read this before judging "completeness")

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

## 3. Business Rules (the parts that must never be "wrong")

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

## 4. Roles & Permission Summary

| Action | Super Admin | HR/Admin | Employee |
|---|---|---|---|
| Manage employees/departments | ✅ | ✅ (employee accounts only) | ❌ |
| Create HR/Admin/Catering accounts | ✅ | ❌ | ❌ |
| Configure meal types / cutoff / enable-disable | ✅ | ❌ | ❌ |
| Set meal price | ✅ | ❌ | ❌ |
| Submit / modify own meal response | — | — | ✅ (before cutoff) |
| Mark serving status | ✅ | ✅ | ❌ |
| Record / void payments | ✅ | ✅ | ❌ |
| View all employees' financials | ✅ | ✅ | ❌ (own only) |
| View own meals/payments/bill | — | — | ✅ |
| View audit log | ✅ | ❌ | ❌ |
| Export reports (Excel/PDF) | ✅ | ✅ | ✅ (own bill only) |

---

## 5. Database Schema (ERD, text form)

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

## 6. API Overview

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
| POST | `/api/meal-response` | Submit/modify today's response (cutoff enforced) |
| GET/POST | `/api/serving` | Daily roster / bulk mark serving status |
| GET/POST | `/api/payments` | List (search/filter/paginate) / record |
| POST | `/api/payments/:id/void` | Void with required reason |
| GET/POST | `/api/settlement` | Monthly table / recompute |
| GET/POST | `/api/holidays` | List / add calendar exceptions |
| GET | `/api/reports/daily` \| `monthly` \| `department` | Report JSON |
| GET | `/api/reports/employee/:id` | Employee bill JSON |
| GET | `/api/export/excel?report=...` | Excel download (daily/monthly/department/employee-bill) |
| GET | `/api/export/pdf?report=...` | PDF download (same report types) |
| GET | `/api/audit` | Audit log (Super Admin only) |
| GET | `/api/dashboard/hr` \| `/api/dashboard/employee` | Dashboard summaries |

---

## 7. Local Setup

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

## 8. Deploying to Vercel (free tier, step by step)

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

## 9. Project Structure

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

## 10. Troubleshooting

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

## 11. Security Checklist Before Going Live

- [ ] Rotate `JWT_SECRET` and every seeded demo password
- [ ] Put the app behind HTTPS (Vercel does this by default)
- [ ] Restrict the Postgres instance to accept connections only from Vercel
- [ ] Review `src/lib/api.ts#requireRole` usage on any new route you add —
      every route must call it; there is no global middleware gate
- [ ] Set up regular Postgres backups (Neon/Vercel Postgres both offer this
      on paid tiers; export critical tables periodically otherwise)
