"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiPost } from "@/lib/apiClient";

const HR_NAV = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/daily", label: "Daily Meal Roster" },
  { href: "/admin/employees", label: "Employees" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/settlement", label: "Settlement" },
  { href: "/admin/reports", label: "Reports" }
];

const SUPER_ADMIN_ONLY_NAV = [
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/audit", label: "Audit Log" }
];

const EMPLOYEE_NAV = [
  { href: "/dashboard", label: "Today's Lunch" },
  { href: "/my-meals", label: "My Meals & Payments" }
];

export default function Shell({
  role,
  name,
  children
}: {
  role: "SUPER_ADMIN" | "HR_ADMIN" | "EMPLOYEE";
  name: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const baseNav = role === "EMPLOYEE" ? EMPLOYEE_NAV : HR_NAV;
  const nav = role === "SUPER_ADMIN" ? [...baseNav, ...SUPER_ADMIN_ONLY_NAV] : baseNav;

  async function logout() {
    await apiPost("/api/auth/logout");
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-60 flex-col bg-ink-950 text-white">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="text-base font-semibold">🍽 Meal System</div>
          <div className="text-xs text-white/50 mt-0.5">Corporate Lunch Management</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-brand-600 text-white" : "text-white/70 hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 text-xs text-white/50">v1.0.0</div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-ink-100 bg-white flex items-center justify-between px-4 md:px-6">
          <div className="md:hidden font-semibold">🍽 Meal System</div>
          <div className="hidden md:block text-sm text-ink-500">
            {role === "EMPLOYEE" ? "Employee Portal" : role === "SUPER_ADMIN" ? "Super Admin Console" : "HR / Admin Console"}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-ink-800">{name}</span>
            <span className="badge bg-ink-100 text-ink-600">{role.replaceAll("_", " ")}</span>
            <button className="btn btn-ghost" onClick={logout}>
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto">{children}</main>
        <nav className="md:hidden sticky bottom-0 bg-white border-t border-ink-100 flex justify-around py-2">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className={`text-xs px-2 py-1 ${pathname?.startsWith(item.href) ? "text-brand-600 font-semibold" : "text-ink-500"}`}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
