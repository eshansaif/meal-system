"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import type { ServerSession } from "@/lib/serverSession";
import { apiPost } from "@/lib/apiClient";
import { useToast } from "@/components/Toast";

export default function ChangePasswordClient({ session }: { session: ServerSession }) {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don\u2019t match");
      return;
    }

    setSaving(true);
    const res = await apiPost("/api/auth/change-password", { currentPassword, newPassword });
    setSaving(false);

    if (!res.success) {
      setError(res.message);
      return;
    }

    toast("Password updated");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <Shell role={session.role} name={session.name}>
      <h1 className="text-xl font-semibold text-ink-900 mb-1">Change Password</h1>
      <p className="text-sm text-ink-500 mb-6">Signed in as {session.email}</p>

      <form onSubmit={submit} className="card p-6 max-w-md space-y-4">
        {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

        <div>
          <label className="label">Current Password</label>
          <input
            className="input"
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="label">New Password</label>
          <input
            className="input"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Confirm New Password</label>
          <input
            className="input"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <button className="btn btn-primary w-full" disabled={saving} type="submit">
          {saving ? "Updating…" : "Update Password"}
        </button>
      </form>
    </Shell>
  );
}
