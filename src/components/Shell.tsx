"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiPost } from "@/lib/apiClient";
import type { Role } from "@prisma/client";

const HR_NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/admin/daily", label: "Daily Meal Roster", icon: "🍱" },
  { href: "/admin/employees", label: "Employees", icon: "👥" },
  { href: "/admin/payments", label: "Payments", icon: "💳" },
  { href: "/admin/settlement", label: "Settlement", icon: "🧾" },
  { href: "/admin/reports", label: "Reports", icon: "📑" }
];

const SUPER_ADMIN_ONLY_NAV = [
  { href: "/admin/calendar", label: "Calendar & Holidays", icon: "📅" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
  { href: "/admin/audit", label: "Audit Log", icon: "🕵️" }
];

const HR_CALENDAR_NAV = [{ href: "/admin/calendar", label: "Calendar & Holidays", icon: "📅" }];

const EMPLOYEE_NAV = [
  { href: "/dashboard", label: "Today's Lunch", icon: "🍽" },
  { href: "/my-meals", label: "My Meals & Payments", icon: "🧾" }
];

const ACCOUNT_NAV = [{ href: "/account/password", label: "Change Password", icon: "🔑" }];

export default function Shell({
  role,
  name,
  children
}: {
  // Shell only ever renders for roles that have a portal (EMPLOYEE, HR_ADMIN,
  // SUPER_ADMIN) — other roles (e.g. CATERING) are routed to /pending-access
  // by getSessionOrRedirect/homeFor before reaching here. We still type this
  // as the full Prisma `Role` (not a hand-rolled subset) so it never drifts
  // out of sync with the schema again; the nav lookup below falls back
  // safely for any role that isn't one of the three known portals.
  role: Role;
  name: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const baseNav = role === "EMPLOYEE" ? EMPLOYEE_NAV : HR_NAV;
  const nav =
    role === "SUPER_ADMIN" ? [...baseNav, ...SUPER_ADMIN_ONLY_NAV] : role === "HR_ADMIN" ? [...baseNav, ...HR_CALENDAR_NAV] : baseNav;

  // Close the drawer automatically whenever the route changes, and lock
  // background scroll while it's open.
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  async function logout() {
    await apiPost("/api/auth/logout");
    router.push("/login");
    router.refresh();
  }

  const consoleLabel = role === "EMPLOYEE" ? "Employee Portal" : role === "SUPER_ADMIN" ? "Super Admin Console" : "HR / Admin Console";

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col bg-ink-950 text-white shrink-0">
        <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
          <img src="/brand/logo.png" alt="Smile Food Products Limited" className="w-9 h-9 shrink-0" />
          <div className="min-w-0">
            <div className="text-base font-semibold truncate">Meal &amp; Cost Management</div>
            <div className="text-xs text-white/50 mt-0.5 truncate">Smile Food Products Limited</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map((item) => (
            <NavLink key={item.href} item={item} active={!!pathname?.startsWith(item.href)} />
          ))}
        </nav>
        <div className="px-3 py-3 border-t border-white/10 space-y-1">
          {ACCOUNT_NAV.map((item) => (
            <NavLink key={item.href} item={item} active={!!pathname?.startsWith(item.href)} />
          ))}
        </div>

      </aside>

      {/* Mobile slide-in drawer + backdrop */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-ink-950/50 transition-opacity ${menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden={!menuOpen}
      />
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] flex flex-col bg-ink-950 text-white transition-transform duration-200 ${menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/brand/logo.png" alt="Smile Food Products Limited" className="w-9 h-9 shrink-0" />
            <div className="min-w-0">
              <div className="text-base font-semibold truncate">Meal &amp; Cost Management</div>
              <div className="text-xs text-white/50 mt-0.5 truncate">Smile Food Products Limited</div>
            </div>
          </div>
          <button
            className="p-2 -mr-2 text-white/70 hover:text-white"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="px-5 py-4 border-b border-white/10">
          <div className="text-sm font-medium">{name}</div>
          <span className="badge bg-white/10 text-white/80 mt-1">{role.replaceAll("_", " ")}</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map((item) => (
            <NavLink key={item.href} item={item} active={!!pathname?.startsWith(item.href)} onClick={() => setMenuOpen(false)} />
          ))}
        </nav>
        <div className="px-3 py-3 border-t border-white/10 space-y-1">
          {ACCOUNT_NAV.map((item) => (
            <NavLink key={item.href} item={item} active={!!pathname?.startsWith(item.href)} onClick={() => setMenuOpen(false)} />
          ))}
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-300 hover:bg-white/10"
            onClick={logout}
          >
            <span aria-hidden>🚪</span> Logout
          </button>
        </div>
        <div className="px-5 py-3 border-t border-white/10 text-[11px] leading-snug text-white/40">
          <div>Designed &amp; Developed by Md. Shanjeed Saif, Officer &ndash; IT</div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-ink-100 bg-white flex items-center justify-between px-3 sm:px-4 md:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <button
              className="md:hidden p-2 -ml-2 text-ink-700 hover:bg-ink-100 rounded-lg shrink-0"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              <HamburgerIcon />
            </button>
            <span className="md:hidden font-semibold truncate flex items-center gap-2">
              <img src="/brand/logo.png" alt="Smile Food Products Limited" className="w-6 h-6" />
              Meal System
            </span>
            <span className="hidden md:block text-sm text-ink-500 truncate">{consoleLabel}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="hidden sm:inline text-sm font-medium text-ink-800 truncate max-w-[10rem]">{name}</span>
            <span className="hidden sm:inline badge bg-ink-100 text-ink-600">{role.replaceAll("_", " ")}</span>
            <button className="hidden md:inline-flex btn btn-ghost" onClick={logout}>
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 p-3 sm:p-4 md:p-6 max-w-7xl w-full mx-auto overflow-x-hidden">{children}</main>

        <footer className="border-t border-ink-100 bg-white text-sm text-ink-500 px-3 sm:px-4 md:px-6 py-3 flex items-center justify-center">
          <div className="flex items-center justify-center gap-2 text-center">
            <span>
              © SFPL &nbsp;|&nbsp; Designed &amp; Developed by Md. Shanjeed Saif, Officer &ndash; IT
            </span>
          </div>
        </footer>


      </div>
    </div>
  );
}

function NavLink({
  item,
  active,
  onClick
}: {
  item: { href: string; label: string; icon: string };
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? "bg-brand-600 text-white" : "text-white/70 hover:bg-white/10"
        }`}
    >
      <span aria-hidden>{item.icon}</span>
      {item.label}
    </Link>
  );
}

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
