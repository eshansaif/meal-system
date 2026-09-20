"use client";

import { useRouter } from "next/navigation";
import type { ServerSession } from "@/lib/serverSession";
import { apiPost } from "@/lib/apiClient";

export default function PendingAccessClient({ session }: { session: ServerSession }) {
  const router = useRouter();

  async function logout() {
    await apiPost("/api/auth/logout");
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 px-4">
      <div className="card max-w-sm w-full p-6 text-center">
        <div className="text-3xl mb-2">🛠️</div>
        <h1 className="text-lg font-semibold text-ink-900">No portal yet for your account type</h1>
        <p className="text-sm text-ink-500 mt-2">
          Your account is signed in as <span className="font-medium text-ink-700">{session.role.replaceAll("_", " ")}</span> ({session.email}),
          which doesn&rsquo;t have a dedicated screen in this system yet. Please contact your administrator.
        </p>
        <button className="btn btn-secondary w-full mt-5" onClick={logout}>
          Logout
        </button>
      </div>
    </div>
  );
}
