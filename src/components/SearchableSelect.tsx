"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

/**
 * A searchable combobox for large option sets (e.g. 100+ employees).
 * Filters client-side over the provided options; supports keyboard nav,
 * a clear button, loading and empty states.
 */
export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search...",
  loading = false,
  disabled = false
}: {
  options: SelectOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) || null;

  const filtered = useMemo(() => {
    if (!query.trim()) return options.slice(0, 50);
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q)).slice(0, 50);
  }, [options, query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlight]) {
        onChange(filtered[highlight].value);
        setOpen(false);
        setQuery("");
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <div
        className={`input flex items-center justify-between cursor-text ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        onClick={() => setOpen(true)}
      >
        {open ? (
          <input
            autoFocus
            className="w-full outline-none"
            value={query}
            placeholder={placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <span className={selected ? "text-ink-800" : "text-ink-400"}>
            {selected ? `${selected.label}${selected.sublabel ? " · " + selected.sublabel : ""}` : placeholder}
          </span>
        )}
        <div className="flex items-center gap-1 ml-2">
          {selected && !open && (
            <button
              type="button"
              className="text-ink-400 hover:text-ink-700"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              aria-label="Clear selection"
            >
              ✕
            </button>
          )}
          <span className="text-ink-300">▾</span>
        </div>
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-ink-200 bg-white shadow-popover">
          {loading ? (
            <div className="px-3 py-3 text-sm text-ink-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-3 text-sm text-ink-400">No matches found</div>
          ) : (
            filtered.map((opt, i) => (
              <div
                key={opt.value}
                className={`px-3 py-2 text-sm cursor-pointer ${i === highlight ? "bg-brand-50" : ""} ${opt.value === value ? "font-medium text-brand-700" : ""}`}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {opt.label}
                {opt.sublabel && <span className="text-ink-400"> · {opt.sublabel}</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
