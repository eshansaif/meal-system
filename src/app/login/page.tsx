"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/apiClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await apiPost("/api/auth/login", { email, password });
    setLoading(false);
    if (!res.success) {
      setError(res.message);
      return;
    }
    router.push(res.data.role === "EMPLOYEE" ? "/dashboard" : "/admin/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ink-950 to-brand-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-3xl">🍽</div>
          <h1 className="text-white text-xl font-semibold mt-2">Meal & Cost Management</h1>
          <p className="text-white/60 text-sm">Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <button className="btn btn-primary w-full" disabled={loading} type="submit">
            {loading ? "Signing in…" : "Sign In"}
          </button>
          <p className="text-xs text-ink-400 text-center pt-1">
            Demo: superadmin@company.com / SuperAdmin@123 &nbsp;·&nbsp; hr@company.com / HrAdmin@123
          </p>
        </form>
      </div>
    </div>
  );
}
