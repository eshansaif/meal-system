"use client";

const COLORS: Record<string, string> = {
  TAKING: "bg-emerald-100 text-emerald-700",
  NOT_TAKING: "bg-ink-100 text-ink-600",
  NO_RESPONSE: "bg-amber-100 text-amber-700",
  SERVED: "bg-emerald-100 text-emerald-700",
  NOT_SERVED: "bg-red-100 text-red-700",
  PENDING: "bg-amber-100 text-amber-700",
  CANCELLED: "bg-ink-200 text-ink-600",
  EXTRA: "bg-brand-100 text-brand-700",
  PAID: "bg-emerald-100 text-emerald-700",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  UNPAID: "bg-red-100 text-red-700",
  OVERPAID: "bg-brand-100 text-brand-700",
  ACTIVE: "bg-emerald-100 text-emerald-700",
  INACTIVE: "bg-ink-200 text-ink-600",
  VOIDED: "bg-red-100 text-red-700"
};

export default function Badge({ status }: { status: string }) {
  const cls = COLORS[status] || "bg-ink-100 text-ink-600";
  return <span className={`badge ${cls}`}>{status.replaceAll("_", " ")}</span>;
}
