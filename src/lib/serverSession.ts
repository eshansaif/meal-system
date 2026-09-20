import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { requireUser } from "./auth";

export interface ServerSession {
  role: Role;
  email: string;
  name: string;
  employeeId: string | null;
}

/** Roles that have a real portal in this app today. Any other role (e.g.
 * CATERING, which has no dedicated UI yet — see README) is routed to a
 * neutral "pending access" page instead of bouncing between admin/employee
 * homes, which would otherwise redirect-loop. */
const PORTAL_HOME: Partial<Record<Role, string>> = {
  EMPLOYEE: "/dashboard",
  HR_ADMIN: "/admin/dashboard",
  SUPER_ADMIN: "/admin/dashboard"
};

export function homeFor(role: Role): string {
  return PORTAL_HOME[role] ?? "/pending-access";
}

/**
 * Resolves the current session ON THE SERVER, before any HTML is sent.
 * Redirects immediately (no client-side flash/loading state) if the person
 * isn't logged in, or isn't allowed on this page. Use this from a Server
 * Component `page.tsx` and pass the result down to a "use client" component
 * as a prop — pages should NOT re-check auth client-side on top of this.
 */
export async function getSessionOrRedirect(allowed?: Role[]): Promise<ServerSession> {
  const user = await requireUser();
  if (!user) redirect("/login");
  if (allowed && !allowed.includes(user.role)) redirect(homeFor(user.role));
  return {
    role: user.role,
    email: user.email,
    name: user.employee?.name ?? user.email,
    employeeId: user.employee?.id ?? null
  };
}

export async function getOptionalSession(): Promise<ServerSession | null> {
  const user = await requireUser();
  if (!user) return null;
  return {
    role: user.role,
    email: user.email,
    name: user.employee?.name ?? user.email,
    employeeId: user.employee?.id ?? null
  };
}
