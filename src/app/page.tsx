"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/apiClient";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    apiGet("/api/auth/me").then((res) => {
      if (res.success && res.data) {
        router.replace(res.data.role === "EMPLOYEE" ? "/dashboard" : "/admin/dashboard");
      } else {
        router.replace("/login");
      }
    });
  }, [router]);
  return <div className="min-h-screen flex items-center justify-center text-ink-400">Loading…</div>;
}
