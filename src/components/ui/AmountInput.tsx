"use client";

import type { InputHTMLAttributes } from "react";
import { isAmountTyping, normalizeAmountText } from "@/lib/money";

// An amount field: digits (Latin or Arabic-Indic), thousands commas and one
// decimal separator with at most 3 decimals; anything else typed or pasted is
// ignored, and Arabic-Indic digits are shown as Latin digits. The form
// parses the text with parseAmount / parseOptionalAmount on submit and passes
// `error` back to show under the field; `onErrorDismiss` runs on every edit
// so the form can clear it.

export const AMOUNT_ERROR = {
  ar: "أدخل مبلغاً صحيحاً",
  en: "Enter a valid amount",
} as const;

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "inputMode"
> & {
  value: string | number;
  onValueChange: (value: string) => void;
  error?: string | null;
  onErrorDismiss?: () => void;
};

export default function AmountInput({
  value,
  onValueChange,
  error,
  onErrorDismiss,
  className = "input",
  dir = "ltr",
  ...rest
}: Props) {
  return (
    <div className="min-w-0">
      <input
        {...rest}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        dir={dir}
        value={value}
        aria-invalid={error ? true : undefined}
        className={error ? `${className} !border-red-500 dark:!border-red-400` : className}
        onChange={(event) => {
          if (!isAmountTyping(event.target.value)) return;
          onErrorDismiss?.();
          onValueChange(normalizeAmountText(event.target.value));
        }}
      />
      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-bold text-red-500 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
