# Manual QA Checklist

No automated test suite was written in this delivery (see README §2). This
checklist covers the same scenarios the spec asked to be tested — run
through it after any change to `src/lib/pricing.ts`, `consumption.ts`,
`settlement.ts`, or the meal-response cutoff logic, since those four files
carry all the financial correctness.

## Auth & Authorization
- [ ] Login with each of the three seeded roles; confirm each lands on the
      correct home page (`/admin/dashboard` vs `/dashboard`)
- [ ] Log in as Employee, try to open `/admin/employees` directly by URL —
      should redirect to `/dashboard`
- [ ] Call `GET /api/employees` with an employee's session cookie via curl —
      should get `403 FORBIDDEN`, not data
- [ ] Deactivate a user (via Employee status), confirm they can no longer
      log in, but their historical meal/payment rows still appear in reports

## Meal Response & Cutoff
- [ ] As an employee, submit "Taking" before cutoff — confirm it saves
- [ ] Change your system clock (or temporarily set a meal type's
      `cutoffTime` to a minute from now), wait, then try to change the
      response — should return `409 CUTOFF_PASSED`
- [ ] Submit the same response twice in a row (simulating a network retry)
      — confirm no duplicate row is created (check `MealResponse` table —
      the `@@unique` constraint plus `upsert` guarantees this)
- [ ] Add a holiday for today via Settings, confirm the employee dashboard
      shows "holiday — no response required" and blocks submission

## Serving & Charges
- [ ] Mark an employee `SERVED` for a date with no price configured — should
      fail with `NO_PRICE_CONFIGURED` (409)
- [ ] Configure a price, mark `SERVED` — confirm `chargeAmount` equals the
      configured unit price, and `unitPriceApplied`/`priceHistoryId` are set
- [ ] Mark the same employee `NOT_SERVED` afterward — confirm `chargeAmount`
      resets to 0 and `isChargeable` becomes false
- [ ] Bulk-select 5 employees, mark all `SERVED` — confirm all 5 update and
      their settlement snapshots recompute (check the Settlement page)

## Price History (the "never rewrite the past" rule)
- [ ] With Sep priced at 100 and Oct at 110 (seeded data), pull up an
      employee's September bill — confirm every September row shows ৳100,
      even after you view/change the October price
- [ ] Try to add a new price period starting on a date that already falls
      inside an existing active period — should still succeed but close the
      old period the day before; verify no gap or overlap in
      `MealPriceHistory` (query the table directly to check date ranges)

## Payments & Settlement
- [ ] Record a payment equal to an employee's meal cost — status → `PAID`
- [ ] Record a partial payment — status → `PARTIALLY_PAID`, outstanding > 0
- [ ] Record zero payments — status → `UNPAID`
- [ ] Record a payment larger than the cost — status → `OVERPAID`, `credit`
      > 0, `outstanding` = 0 (never negative)
- [ ] Void a payment, confirm settlement recomputes back to the pre-payment
      state, and the payment row still exists with `status = VOIDED` and a
      reason
- [ ] Carry an outstanding balance from September into October (don't pay it
      off), confirm October's `previousOutstanding` reflects it correctly

## Reports & Export
- [ ] Compare the on-screen Monthly Report totals to the downloaded Excel
      and PDF for the same month — all three must match exactly (they share
      `src/lib/reports.ts`)
- [ ] Download an employee's bill as an employee (not HR) — confirm you can
      only fetch your own `employeeId`, not someone else's (`403` otherwise)
- [ ] Export the Daily catering sheet, confirm "Expected Meals" matches the
      HR dashboard's "Expected Meals" for the same date

## Search / Filter / Pagination
- [ ] On Employees, Payments, and Daily Roster pages: search by partial
      name, by employee code, and by email — confirm case-insensitive match
- [ ] Set page size boundaries (first page, last page) and confirm the
      "Showing X–Y of Z" text is accurate
- [ ] Combine two filters at once (e.g. department + payment status) and
      confirm both apply together, not just the last one changed

## Monthly Planning & Working Days
- [ ] As an employee, tap "Set Whole Month" — confirm every remaining
      working day this month becomes `TAKING`, and weekends/holidays are
      skipped
- [ ] After planning the month, cancel one specific future day from the
      list — confirm only that day changes to `NOT_TAKING`, the rest stay
      `TAKING`
- [ ] Try to cancel a day that's already past its cutoff (e.g. today after
      cutoff) — the row should show "Locked" with no action available
- [ ] As Super Admin, change the working-days pattern (e.g. remove
      Thursday) — confirm "Set Whole Month" no longer plans Thursdays
- [ ] As Super Admin, add a Holiday for a date that already has `TAKING`
      responses and a `SERVED` consumption recorded — confirm those
      responses flip to `NOT_TAKING`/locked, the consumption is `CANCELLED`
      with `chargeAmount` reset to 0, and the employee's settlement for that
      month recomputes to reflect the removed charge

## Password Change & Roles Without a Portal
- [ ] Change your own password with the correct current password — confirm
      login works with the new one and fails with the old one
- [ ] Try changing password with a wrong current password — confirm a clear
      `401 INVALID_CURRENT_PASSWORD` and no change happens
- [ ] As HR (not Super Admin), open `/admin/calendar` — confirm it loads
      (this moved out of the Super-Admin-only Settings page) and that HR can
      both set working days and add/remove holidays
- [ ] As HR, confirm `/admin/settings` and `/admin/audit` are NOT in the
      sidebar and redirect away if visited directly by URL

## Edge Cases (spec §53)
- [ ] Employee with zero meal history this month — dashboard/bill should
      show zeros, not crash
- [ ] Department with zero employees — Department Report should simply omit
      it, not error
- [ ] Two admins mark the same employee `SERVED` then `NOT_SERVED` in quick
      succession — final state should be whichever request completed last
      (Prisma upsert is atomic per row; no partial writes)
