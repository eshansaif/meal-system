"use client";

import { useEffect, useState, useCallback } from "react";
import Shell from "@/components/Shell";
import Badge from "@/components/Badge";
import { apiGet, apiPost } from "@/lib/apiClient";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { StatGridSkeleton, TableSkeleton, CardSkeleton } from "@/components/Skeleton";
import type { ServerSession } from "@/lib/serverSession";

interface MealTypeInfo { id: string; name: string; currentUnitPrice: string | null }
interface TodayStatus {
  date: string;
  status: "TAKING" | "NOT_TAKING" | "NO_RESPONSE";
  isLocked: boolean;
  cutoffTime: string;
  isHoliday: boolean;
  holidayLabel: string | null;
}

function useCountdown(cutoffTime: string) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    const [h, m] = cutoffTime.split(":").map(Number);
    const tick = () => {
      const now = new Date();
      const cutoff = new Date();
      cutoff.setHours(h, m, 0, 0);
      const diff = cutoff.getTime() - now.getTime();
      if (diff <= 0) {
        setRemaining("closed");
        return;
      }
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(mins / 60);
      setRemaining(`${hrs}h ${mins % 60}m`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [cutoffTime]);
  return remaining;
}

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function DashboardClient({ session }: { session: ServerSession }) {
  const toast = useToast();
  const [mealType, setMealType] = useState<MealTypeInfo | null>(null);
  const [today, setToday] = useState<TodayStatus | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmMonthPlan, setConfirmMonthPlan] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const load = useCallback(async () => {
    const [mealTypesRes, dashRes] = await Promise.all([
      apiGet<MealTypeInfo[]>("/api/meal-types?onlyEnabled=true"),
      apiGet("/api/dashboard/employee")
    ]);
    const lunch = mealTypesRes.data?.[0];
    setMealType(lunch ?? null);
    if (dashRes.success) setSummary(dashRes.data);
    if (lunch) {
      const todayRes = await apiGet<TodayStatus>(`/api/meal-response/today?mealTypeId=${lunch.id}`);
      if (todayRes.success) setToday(todayRes.data!);
    }
    setPageLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const countdown = useCountdown(today?.cutoffTime || "10:30");

  async function respond(status: "TAKING" | "NOT_TAKING") {
    if (!mealType) return;
    setSubmitting(true);
    const res = await apiPost("/api/meal-response", { mealTypeId: mealType.id, status });
    setSubmitting(false);
    if (!res.success) {
      toast(res.message, "error");
      return;
    }
    toast("Response saved");
    load();
  }

  async function planWholeMonth() {
    if (!mealType) return;
    setConfirmMonthPlan(false);
    const res = await apiPost("/api/meal-response/monthly", { mealTypeId: mealType.id, month: currentMonthStr() });
    if (!res.success) {
      toast(res.message, "error");
      return;
    }
    toast(res.message);
    load();
  }

  return (
    <Shell role={session.role} name={session.name}>
      <h1 className="text-xl font-semibold text-ink-900 mb-4">Today's Lunch</h1>

      {pageLoading ? (
        <CardSkeleton lines={2} />
      ) : (
        <div className="card p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-sm text-ink-500">{today ? new Date(today.date).toDateString() : ""}</div>
            <div className="mt-1">{today && <Badge status={today.isHoliday ? "NO_RESPONSE" : today.status} />}</div>
          </div>
          {today && !today.isLocked && !today.isHoliday && (
            <div className="text-sm text-ink-500">
              Response closes at <span className="font-semibold text-ink-800">{today.cutoffTime}</span>
              {countdown !== "closed" && <span className="ml-2 text-brand-600 font-semibold">({countdown} left)</span>}
            </div>
          )}
        </div>

        {today?.isHoliday ? (
          <div className="mt-4 rounded-lg bg-amber-50 text-amber-700 text-sm px-4 py-3">
            Today is a holiday ({today.holidayLabel}) — no lunch response is required.
          </div>
        ) : today?.isLocked ? (
          <div className="mt-4 rounded-lg bg-ink-100 text-ink-600 text-sm px-4 py-3">
            Your response for today is locked and can no longer be changed.
          </div>
        ) : (
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <button
              disabled={submitting}
              onClick={() => respond("TAKING")}
              className={`btn flex-1 py-3 text-base ${today?.status === "TAKING" ? "btn-primary" : "btn-secondary"}`}
            >
              ✅ YES, TAKE MY LUNCH
            </button>
            <button
              disabled={submitting}
              onClick={() => respond("NOT_TAKING")}
              className={`btn flex-1 py-3 text-base ${today?.status === "NOT_TAKING" ? "btn-danger" : "btn-secondary"}`}
            >
              ❌ NO, I WILL NOT TAKE LUNCH
            </button>
          </div>
        )}
        </div>
      )}

      {mealType && !pageLoading && (
        <div className="card p-5 mb-6 bg-brand-50/50 border-brand-100">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="font-medium text-ink-900">Planning to eat lunch all month?</div>
              <p className="text-sm text-ink-500 mt-0.5">
                Set every remaining working day this month to "Taking Lunch" in one tap. You can still cancel any
                individual day below, any time before that day's cutoff.
              </p>
            </div>
            <button className="btn btn-primary whitespace-nowrap" onClick={() => setConfirmMonthPlan(true)}>
              📅 Set Whole Month
            </button>
          </div>
        </div>
      )}

      {mealType && !pageLoading && <MonthPlan mealTypeId={mealType.id} onChanged={load} />}

      {pageLoading ? (
        <>
          <StatGridSkeleton />
          <TableSkeleton rows={5} cols={4} />
        </>
      ) : summary ? (
        <>
          <h2 className="text-lg font-semibold text-ink-900 mb-3 mt-8">Monthly Summary ({summary.month})</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Meals Taken" value={summary.monthlySummary.mealsServed} />
            <StatCard label="Meal Cost" value={`৳${Number(summary.monthlySummary.mealCost).toFixed(2)}`} />
            <StatCard label="Paid" value={`৳${Number(summary.lifetime.totalPaid).toFixed(2)}`} />
            <StatCard
              label="Outstanding"
              value={`৳${Number(summary.lifetime.currentOutstanding).toFixed(2)}`}
              accent={Number(summary.lifetime.currentOutstanding) > 0 ? "text-red-600" : "text-emerald-600"}
            />
          </div>

          <h2 className="text-lg font-semibold text-ink-900 mb-3">Recent Meal History</h2>
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Meal</th>
                  <th>Status</th>
                  <th>Charge</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentHistory.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-ink-400 py-6">
                      No meal history yet.
                    </td>
                  </tr>
                ) : (
                  summary.recentHistory.map((h: any) => (
                    <tr key={h.id}>
                      <td>{new Date(h.date).toDateString()}</td>
                      <td>{h.mealType.name}</td>
                      <td><Badge status={h.servingStatus} /></td>
                      <td>৳{Number(h.chargeAmount).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={confirmMonthPlan}
        title='Set the whole month to "Taking Lunch"?'
        description="Every remaining working day this month (excluding holidays and any day you've already explicitly cancelled) will be set to Taking Lunch. You can still cancel individual days afterward, any time before that day's cutoff."
        confirmLabel="Yes, Plan the Month"
        onConfirm={planWholeMonth}
        onCancel={() => setConfirmMonthPlan(false)}
      />
    </Shell>
  );
}

function MonthPlan({ mealTypeId, onChanged }: { mealTypeId: string; onChanged: () => void }) {
  const toast = useToast();
  const [days, setDays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyDate, setBusyDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const monthEnd = new Date(Date.UTC(today.getFullYear(), today.getMonth() + 1, 0));
    const to = monthEnd.toISOString().slice(0, 10);
    const res = await apiGet(`/api/meal-response/range?mealTypeId=${mealTypeId}&from=${from}&to=${to}`);
    if (res.success) setDays(res.data);
    setLoading(false);
  }, [mealTypeId]);

  useEffect(() => { load(); }, [load]);

  async function setDay(date: string, status: "TAKING" | "NOT_TAKING") {
    setBusyDate(date);
    const res = await apiPost("/api/meal-response", { mealTypeId, date, status });
    setBusyDate(null);
    if (!res.success) {
      toast(res.message, "error");
      return;
    }
    load();
    onChanged();
  }

  const workingDays = days.filter((d) => d.isWorkingDay);

  return (
    <div className="card overflow-hidden mb-6">
      <div className="px-4 py-3 border-b border-ink-100 font-medium text-ink-900">This Month's Lunch Plan</div>
      {loading ? (
        <div className="p-2"><TableSkeleton rows={4} cols={3} /></div>
      ) : workingDays.length === 0 ? (
        <div className="p-6 text-center text-ink-400">No remaining working days this month.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>Date</th><th>Status</th><th>Set as</th></tr>
          </thead>
          <tbody>
            {workingDays.map((d) => (
              <tr key={d.date}>
                <td>{new Date(d.date + "T00:00:00Z").toDateString()}{d.isMonthlyDefault && <span className="ml-2 text-xs text-brand-600">(monthly plan)</span>}</td>
                <td><Badge status={d.status} /></td>
                <td>
                  {d.isLocked ? (
                    <span className="text-xs text-ink-400">Locked</span>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        className="btn btn-secondary text-xs"
                        disabled={busyDate === d.date || d.status === "TAKING"}
                        onClick={() => setDay(d.date, "TAKING")}
                      >
                        Take
                      </button>
                      <button
                        className="btn btn-secondary text-xs"
                        disabled={busyDate === d.date || d.status === "NOT_TAKING"}
                        onClick={() => setDay(d.date, "NOT_TAKING")}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-ink-500">{label}</div>
      <div className={`text-xl font-semibold mt-1 ${accent || "text-ink-900"}`}>{value}</div>
    </div>
  );
}
