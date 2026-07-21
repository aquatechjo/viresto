"use client";

import type { InputHTMLAttributes } from "react";
import { Search, X } from "lucide-react";

interface VDSSearchInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "className" | "onChange" | "type" | "value"
  > {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
  clearLabel?: string;
}

export default function VDSSearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className = "",
  inputClassName = "",
  clearLabel = "Clear search",
  disabled,
  style: inputStyle,
  ...inputProps
}: VDSSearchInputProps) {
  return (
    <label className={`relative block min-w-0 ${className}`}>
      <Search
        className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2"
        style={{ color: "var(--text-3)" }}
        aria-hidden="true"
      />
      <input
        {...inputProps}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`h-12 min-h-12 w-full appearance-none rounded-2xl border bg-transparent ps-10 pe-10 text-start text-sm font-semibold outline-none transition focus:ring-2 focus:ring-[#b87333]/20 disabled:cursor-not-allowed disabled:opacity-60 [&::-webkit-search-cancel-button]:hidden ${inputClassName}`}
        style={{
          borderColor: "var(--border)",
          color: "var(--text)",
          background: "var(--surface)",
          ...inputStyle,
        }}
      />
      {value && !disabled ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute end-2.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b87333]/30 dark:hover:bg-white/10"
          style={{ color: "var(--text-2)" }}
          aria-label={clearLabel}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </label>
  );
}
