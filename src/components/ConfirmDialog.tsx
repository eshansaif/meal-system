"use client";

import { useState } from "react";

export default function ConfirmDialog({
  open,
  title,
  description,
  requireReason = false,
  confirmLabel = "Confirm",
  danger = false,
  onConfirm,
  onCancel
}: {
  open: boolean;
  title: string;
  description?: string;
  requireReason?: boolean;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4" role="dialog" aria-modal="true">
      <div className="card w-full max-w-md p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
        {description && <p className="mt-2 text-sm text-ink-600">{description}</p>}
        {requireReason && (
          <div className="mt-4">
            <label className="label">Reason (required)</label>
            <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this action being taken?" />
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={danger ? "btn btn-danger" : "btn btn-primary"}
            disabled={requireReason && reason.trim().length < 5}
            onClick={() => onConfirm(reason)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
