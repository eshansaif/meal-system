"use client";

import { useEffect, useState, useCallback } from "react";
import Shell from "@/components/Shell";
import type { ServerSession } from "@/lib/serverSession";
import { apiGet, apiPost, apiPatch } from "@/lib/apiClient";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { TableSkeleton } from "@/components/Skeleton";

const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" }
];

export default function CalendarClient({ session }: { session: ServerSession }) {
  const toast = useToast();
  const [workingDays, setWorkingDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [savingDays, setSavingDays] = useState(false);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [newHoliday, setNewHoliday] = useState({ date: "", type: "HOLIDAY", label: "" });
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [wd, hol] = await Promise.all([apiGet<number[]>("/api/settings/working-days"), apiGet("/api/holidays")]);
    if (wd.success) setWorkingDays(wd.data!);
    if (hol.success) setHolidays(hol.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleDay(day: number) {
    setWorkingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  async function saveWorkingDays() {
    setSavingDays(true);
    const res = await apiPatch("/api/settings/working-days", { days: workingDays });
    setSavingDays(false);
    if (!res.success) { toast(res.message, "error"); return; }
    toast("Working days updated — this applies to every month automatically, going forward");
  }

  async function submitHoliday(e: React.FormEvent) {
    e.preventDefault();
    const res = await apiPost("/api/holidays", newHoliday);
    if (!res.success) { toast(res.message, "error"); return; }
    toast(
      newHoliday.type === "HOLIDAY"
        ? "Date blocked — any existing responses for it were cancelled and un-charged"
        : "Date marked as a special working day"
    );
    setNewHoliday({ date: "", type: "HOLIDAY", label: "" });
    load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/holidays/${deleteTarget.id}`, { method: "DELETE", credentials: "include" }).then((r) => r.json());
    if (!res.success) toast(res.message, "error");
    else toast("Removed");
    setDeleteTarget(null);
    load();
  }

  return (
    <Shell role={session.role} name={session.name}>
      <h1 className="text-xl font-semibold text-ink-900 mb-1">Calendar &amp; Holidays</h1>
      <p className="text-sm text-ink-500 mb-6">
        Set the company&rsquo;s standing weekend pattern, and block or unblock specific dates — office holidays or a
        special working day that opens on an otherwise off day.
      </p>

      <h2 className="text-sm font-semibold text-ink-500 uppercase tracking-wide mb-2">Weekly Working Days</h2>
      <div className="card p-4 mb-8">
        <p className="text-sm text-ink-500 mb-3">
          Select which weekdays count as working days for the whole company. This is a standing pattern — it applies
          to every month automatically, not just the current one. Meal responses are only requested on working days.
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {WEEKDAYS.map((d) => {
            const active = workingDays.includes(d.value);
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleDay(d.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  active ? "bg-brand-600 border-brand-600 text-white" : "bg-white border-ink-200 text-ink-500 hover:border-ink-300"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
        <button className="btn btn-primary" disabled={savingDays || workingDays.length === 0} onClick={saveWorkingDays}>
          {savingDays ? "Saving…" : "Save Working Days"}
        </button>
      </div>

      <h2 className="text-sm font-semibold text-ink-500 uppercase tracking-wide mb-2">Block / Unblock Specific Dates</h2>
      <div className="card p-4">
        <p className="text-sm text-ink-500 mb-3">
          <strong>Holiday</strong> = office closed that date — meal is blocked, and any responses or charges already
          recorded for it are automatically cancelled. <strong>Special Working Day</strong> = office opens on an
          otherwise-off day (e.g. a weekend) — meal is unblocked for that one date.
        </p>
        {loading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : (
          <table className="data-table mb-4">
            <thead><tr><th>Date</th><th>Type</th><th>Label</th><th></th></tr></thead>
            <tbody>
              {holidays.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-ink-400 py-4">No entries yet.</td></tr>
              ) : (
                holidays.map((h) => (
                  <tr key={h.id}>
                    <td>{new Date(h.date).toDateString()}</td>
                    <td>
                      <span className={`badge ${h.type === "HOLIDAY" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {h.type.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td>{h.label}</td>
                    <td><button className="btn btn-outline-danger text-xs" onClick={() => setDeleteTarget(h)}>Remove</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
        <form onSubmit={submitHoliday} className="flex flex-wrap items-end gap-3">
          <div><label className="label">Date</label><input type="date" required className="input" value={newHoliday.date} onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })} /></div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={newHoliday.type} onChange={(e) => setNewHoliday({ ...newHoliday, type: e.target.value })}>
              <option value="HOLIDAY">Holiday (office closed — block meal)</option>
              <option value="SPECIAL_WORKING_DAY">Special Working Day (office open — unblock meal)</option>
            </select>
          </div>
          <div><label className="label">Label</label><input required className="input" value={newHoliday.label} onChange={(e) => setNewHoliday({ ...newHoliday, label: e.target.value })} placeholder="e.g. Eid-ul-Fitr" /></div>
          <button className="btn btn-success" type="submit">+ Add</button>
        </form>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove this calendar entry?"
        description="This only removes the block/unblock marker for the date — it does not restore any responses or charges that were cancelled when it was added."
        confirmLabel="Remove"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Shell>
  );
}
