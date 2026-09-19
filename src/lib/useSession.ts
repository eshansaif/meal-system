"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "./apiClient";

export interface Session {
  role: "SUPER_ADMIN" | "HR_ADMIN" | "EMPLOYEE" | "CATERING";
  email: string;
  name: string;
  employeeId: string | null;
}

/** Loads the current session; redirects to /login if unauthenticated, or to a role's home if role mismatch. */
export function useSession(allow?: Session["role"][]) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    apiGet<Session>("/api/auth/me").then((res) => {
      if (cancelled) return;
      if (!res.success || !res.data) {
        router.replace("/login");
        return;
      }
      if (allow && !allow.includes(res.data.role)) {
        router.replace(res.data.role === "EMPLOYEE" ? "/dashboard" : "/admin/dashboard");
        return;
      }
      setSession(res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { session, loading };
}
