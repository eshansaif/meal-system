"use client";

import { useEffect, useState, useCallback } from "react";
import Shell from "@/components/Shell";
import Badge from "@/components/Badge";
import Pagination from "@/components/Pagination";
import ConfirmDialog from "@/components/ConfirmDialog";
import SearchableSelect from "@/components/SearchableSelect";
import { useSession } from "@/lib/useSession";
import { apiGet, apiPost, apiPatch } from "@/lib/apiClient";
import { useToast } from "@/components/Toast";

export default function EmployeesPage() {
  const { session, loading } = useSession(["SUPER_ADMIN", "HR_ADMIN"]);
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, pageSize: 25 });
  const [departments, setDepartments] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; toStatus: "ACTIVE" | "INACTIVE"; name: string } | null>(null);

  useEffect(() => {
    apiGet("/api/departments").then((r) => r.success && setDepartments(r.data));
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page), pageSize: "25",
      ...(search ? { search } : {}), ...(departmentId ? { departmentId } : {}), ...(status ? { status } : {})
    });
    const res = await apiGet(`/api/employees?${params}`);
    if (res.success) {
      setRows(res.data.employees);
      setMeta({ total: res.data.total, totalPages: res.data.totalPages, pageSize: res.data.pageSize });
    }
  }, [page, search, departmentId, status]);

  useEffect(() => { load(); }, [load]);

  async function toggleStatus() {
    if (!confirmTarget) return;
    const res = await apiPatch(`/api/employees/${confirmTarget.id}`, { status: confirmTarget.toStatus });
    if (!res.success) toast(res.message, "error");
    else toast(`${confirmTarget.name} ${confirmTarget.toStatus === "ACTIVE" ? "reactivated" : "deactivated"}`);
    setConfirmTarget(null);
    load();
  }

  if (loading || !session) return <div className="p-8 text-ink-400">Loading…</div>;

  return (
    <Shell role={session.role} name={session.name}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h1 className="text-xl font-semibold text-ink-900">Employees</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Add Employee</button>
      </div>

      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="w-64">
          <label className="label">Search (ID / Name / Email)</label>
          <input className="input" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search…" />
        </div>
        <div className="w-56">
          <label className="label">Department</label>
          <select className="input" value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setPage(1); }}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr><th>ID</th><th>Name</th><th>Department</th><th>Designation</th><th>Status</th><th>Role</th><th></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-ink-400 py-8">No employees found.</td></tr>
            ) : (
              rows.map((e) => (
                <tr key={e.id}>
                  <td>{e.employeeCode}</td>
                  <td>{e.name}<div className="text-xs text-ink-400">{e.email}</div></td>
                  <td>{e.department.name}</td>
                  <td>{e.designation || "-"}</td>
                  <td><Badge status={e.status} /></td>
                  <td className="text-xs text-ink-500">{e.user.role.replaceAll("_", " ")}</td>
                  <td>
                    <button
                      className="btn btn-ghost text-xs"
                      onClick={() => setConfirmTarget({ id: e.id, toStatus: e.status === "ACTIVE" ? "INACTIVE" : "ACTIVE", name: e.name })}
                    >
                      {e.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPageChange={setPage} />
      </div>

      {showCreate && (
        <CreateEmployeeModal departments={departments} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); toast("Employee created"); }} />
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        title={confirmTarget?.toStatus === "INACTIVE" ? "Deactivate employee?" : "Reactivate employee?"}
        description={
          confirmTarget?.toStatus === "INACTIVE"
            ? "Their login will be disabled. Historical meal and payment records are kept intact."
            : "This will re-enable their login."
        }
        confirmLabel={confirmTarget?.toStatus === "INACTIVE" ? "Deactivate" : "Reactivate"}
        danger={confirmTarget?.toStatus === "INACTIVE"}
        onConfirm={toggleStatus}
        onCancel={() => setConfirmTarget(null)}
      />
    </Shell>
  );
}

function CreateEmployeeModal({ departments, onClose, onCreated }: { departments: any[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", designation: "", departmentId: "", joiningDate: new Date().toISOString().slice(0, 10), initialPassword: "Employee@123"
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await apiPost("/api/employees", { ...form, role: "EMPLOYEE" });
    setSaving(false);
    if (!res.success) { setError(res.message); return; }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4">
      <form onSubmit={submit} className="card w-full max-w-lg p-6 space-y-3">
        <h3 className="text-lg font-semibold text-ink-900">Add Employee</h3>
        {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Full Name</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Email</label><input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="label">Designation</label><input className="input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
          <div>
            <label className="label">Department</label>
            <SearchableSelect
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
              value={form.departmentId || null}
              onChange={(v) => setForm({ ...form, departmentId: v || "" })}
              placeholder="Select department"
            />
          </div>
          <div><label className="label">Joining Date</label><input className="input" type="date" required value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} /></div>
        </div>
        <div><label className="label">Initial Password</label><input className="input" required minLength={6} value={form.initialPassword} onChange={(e) => setForm({ ...form, initialPassword: e.target.value })} /></div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving || !form.departmentId}>{saving ? "Saving…" : "Create Employee"}</button>
        </div>
      </form>
    </div>
  );
}
