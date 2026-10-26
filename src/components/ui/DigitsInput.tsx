"use client";

import { useState, type InputHTMLAttributes } from "react";
import { DIGITS_FIELD_LENGTH, TEN_DIGITS, sanitizeDigits } from "@/lib/digits";

// A digits-only field (phone number, national ID): Arabic-Indic and Persian
// digits become Latin digits, anything else typed or pasted is dropped, and
// the value is cut at 10. type="text" (not "number") so a leading 0 stays.
//
// `incompleteMessage` shows under the field once it loses focus with fewer
// than 10 digits; the form passes `error` to show one on submit. A saved
// value that does not fit (older data) is shown untouched until edited.

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "inputMode" | "maxLength"
> & {
  value: string;
  onValueChange: (value: string) => void;
  incompleteMessage?: string;
  error?: string | null;
};

export default function DigitsInput({
  value,
  onValueChange,
  incompleteMessage,
  error,
  className = "input",
  dir = "ltr",
  onBlur,
  ...rest
}: Props) {
  const [touched, setTouched] = useState(false);
  const shown =
    error ||
    (touched && incompleteMessage && value && !TEN_DIGITS.test(value)
      ? incompleteMessage
      : null);

  return (
    <div className="min-w-0">
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        maxLength={DIGITS_FIELD_LENGTH}
        dir={dir}
        value={value}
        aria-invalid={shown ? true : undefined}
        className={shown ? `${className} !border-red-500 dark:!border-red-400` : className}
        onChange={(event) => onValueChange(sanitizeDigits(event.target.value))}
        onPaste={(event) => {
          // maxLength would cut "079 123 4567" to 10 characters before
          // onChange sees it; clean the pasted text first instead.
          event.preventDefault();
          const input = event.currentTarget;
          const start = input.selectionStart ?? input.value.length;
          const end = input.selectionEnd ?? input.value.length;
          onValueChange(
            sanitizeDigits(
              input.value.slice(0, start) +
                event.clipboardData.getData("text") +
                input.value.slice(end),
            ),
          );
        }}
        onBlur={(event) => {
          setTouched(true);
          onBlur?.(event);
        }}
      />
      {shown ? (
        <p role="alert" className="mt-1.5 text-xs font-bold text-red-500 dark:text-red-300">
          {shown}
        </p>
      ) : null}
    </div>
  );
}
