"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import type { ServerSession } from "@/lib/serverSession";
import { apiGet, apiPost, apiPatch } from "@/lib/apiClient";
import { useToast } from "@/components/Toast";
import { TableSkeleton } from "@/components/Skeleton";

export default function SettingsClient({ session }: { session: ServerSession }) {
  const toast = useToast();
  const [mealTypes, setMealTypes] = useState<any[]>([]);
  const [priceHistoryFor, setPriceHistoryFor] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [newPrice, setNewPrice] = useState({ unitPrice: "", effectiveFrom: new Date().toISOString().slice(0, 10) });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const mt = await apiGet("/api/meal-types");
    if (mt.success) setMealTypes(mt.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleEnabled(id: string, isEnabled: boolean) {
    const res = await apiPatch(`/api/meal-types/${id}`, { isEnabled: !isEnabled });
    if (!res.success) toast(res.message, "error");
    load();
  }

  async function updateCutoff(id: string, cutoffTime: string) {
    const res = await apiPatch(`/api/meal-types/${id}`, { cutoffTime });
    if (!res.success) toast(res.message, "error"); else toast("Cutoff updated");
  }

  async function openPriceHistory(id: string) {
    setPriceHistoryFor(id);
    const res = await apiGet(`/api/meal-types/${id}/price`);
    if (res.success) setHistory(res.data);
  }

  async function submitPrice(e: React.FormEvent) {
    e.preventDefault();
    if (!priceHistoryFor) return;
    const res = await apiPost(`/api/meal-types/${priceHistoryFor}/price`, newPrice);
    if (!res.success) { toast(res.message, "error"); return; }
    toast("New price period created");
    setNewPrice({ unitPrice: "", effectiveFrom: new Date().toISOString().slice(0, 10) });
    openPriceHistory(priceHistoryFor);
    load();
  }

  return (
    <Shell role={session.role} name={session.name}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h1 className="text-xl font-semibold text-ink-900">Settings</h1>
        <Link href="/admin/calendar" className="btn btn-secondary">
          📅 Manage Calendar &amp; Holidays
        </Link>
      </div>

      <h2 className="text-sm font-semibold text-ink-500 uppercase tracking-wide mb-2">Meal Types</h2>
      {loading ? (
        <TableSkeleton rows={3} cols={5} />
      ) : (
        <div className="card overflow-x-auto mb-8">
          <table className="data-table">
            <thead><tr><th>Meal</th><th>Enabled</th><th>Cutoff Time</th><th>Current Price</th><th></th></tr></thead>
            <tbody>
              {mealTypes.map((mt) => (
                <tr key={mt.id}>
                  <td>{mt.name}</td>
                  <td>
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={mt.isEnabled} onChange={() => toggleEnabled(mt.id, mt.isEnabled)} />
                      {mt.isEnabled ? "Enabled" : "Disabled"}
                    </label>
                  </td>
                  <td>
                    <input
                      type="time" defaultValue={mt.cutoffTime} className="input w-32"
                      onBlur={(e) => e.target.value !== mt.cutoffTime && updateCutoff(mt.id, e.target.value)}
                    />
                  </td>
                  <td>{mt.currentUnitPrice ? `৳${Number(mt.currentUnitPrice).toFixed(2)}` : "Not set"}</td>
                  <td><button className="btn btn-ghost text-xs" onClick={() => openPriceHistory(mt.id)}>Price History</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {priceHistoryFor && (
        <div className="card p-4 mb-8">
          <h3 className="font-semibold text-ink-900 mb-3">Price History — {mealTypes.find((m) => m.id === priceHistoryFor)?.name}</h3>
          <table className="data-table mb-4">
            <thead><tr><th>Effective From</th><th>Effective To</th><th>Unit Price</th><th>Status</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{new Date(h.effectiveFrom).toDateString()}</td>
                  <td>{h.effectiveTo ? new Date(h.effectiveTo).toDateString() : "Ongoing"}</td>
                  <td>৳{Number(h.unitPrice).toFixed(2)}</td>
                  <td>{h.effectiveTo ? "Closed" : "Active"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <form onSubmit={submitPrice} className="flex flex-wrap items-end gap-3">
            <div><label className="label">New Price</label><input type="number" step="0.01" min="0.01" required className="input w-32" value={newPrice.unitPrice} onChange={(e) => setNewPrice({ ...newPrice, unitPrice: e.target.value })} /></div>
            <div><label className="label">Effective From</label><input type="date" required className="input" value={newPrice.effectiveFrom} onChange={(e) => setNewPrice({ ...newPrice, effectiveFrom: e.target.value })} /></div>
            <button className="btn btn-success" type="submit">Set New Price</button>
          </form>
          <p className="text-xs text-ink-400 mt-2">Setting a new price automatically closes the previous period the day before — past meal charges are never recalculated.</p>
        </div>
      )}
    </Shell>
  );
}
