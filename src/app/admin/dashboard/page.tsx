"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { useSession } from "@/lib/useSession";
import { apiGet } from "@/lib/apiClient";

export default function HrDashboard() {
  const { session, loading } = useSession(["SUPER_ADMIN", "HR_ADMIN"]);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (session) apiGet("/api/dashboard/hr").then((r) => r.success && setData(r.data));
  }, [session]);

  if (loading || !session) return <div className="p-8 text-ink-400">Loading…</div>;

  return (
    <Shell role={session.role} name={session.name}>
      <h1 className="text-xl font-semibold text-ink-900 mb-1">Daily HR Dashboard</h1>
      <p className="text-sm text-ink-500 mb-6">{data ? new Date(data.date).toDateString() : ""} · {data?.mealType?.name}</p>

      {data && (
        <>
          <SectionTitle>Today's Lunch — Operational</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Stat label="Active Employees" value={data.operational.totalActiveEmployees} />
            <Stat label="Taking Lunch" value={data.operational.taking} accent="text-emerald-600" />
            <Stat label="Not Taking" value={data.operational.notTaking} />
            <Stat label="No Response" value={data.operational.noResponse} accent="text-amber-600" />
            <Stat label="Expected Meals" value={data.operational.expectedMeals} accent="text-brand-600" />
            <Stat label="Served" value={data.operational.served} accent="text-emerald-600" />
            <Stat label="Not Served" value={data.operational.notServed} accent="text-red-600" />
            <Stat label="Extra Meals" value={data.operational.extra} />
          </div>

          <SectionTitle>Financial Summary</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Today's Meal Cost" value={`৳${data.financial.todaysMealCost.toFixed(2)}`} />
            <Stat label="Collected Today" value={`৳${data.financial.collectedToday.toFixed(2)}`} accent="text-emerald-600" />
            <Stat label="Month Outstanding" value={`৳${data.financial.monthOutstanding.toFixed(2)}`} accent="text-red-600" />
            <Stat label="Month Meal Cost" value={`৳${data.financial.monthMealCost.toFixed(2)}`} />
          </div>
        </>
      )}
    </Shell>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-ink-500 uppercase tracking-wide mb-3">{children}</h2>;
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-ink-500">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${accent || "text-ink-900"}`}>{value}</div>
    </div>
  );
}
