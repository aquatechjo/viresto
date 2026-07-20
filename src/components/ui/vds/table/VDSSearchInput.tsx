"use client";

import { Search, X } from "lucide-react";

interface VDSSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function VDSSearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className = "",
}: VDSSearchInputProps) {
  return (
    <label className={`relative block min-w-0 ${className}`}>
      <Search
        className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2"
        style={{ color: "var(--text-3)" }}
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-11 w-full rounded-2xl border bg-transparent ps-10 pe-10 text-sm font-semibold outline-none transition focus:ring-2"
        style={{
          borderColor: "var(--border)",
          color: "var(--text)",
          background: "var(--surface)",
        }}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute end-2.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </label>
  );
}
