"use client";

import { useState, type InputHTMLAttributes } from "react";
import { PHONE_INPUT_MAX, isValidPhone, sanitizePhoneInput } from "@/lib/phone";

// A phone field: a Jordanian number in any usual form (0791234567,
// +962 79 123 4567, 00962...) or an international one with its country code
// after "+" or "00". Arabic-Indic and Persian digits become Latin digits;
// letters are dropped. The server stores the E.164 form (src/lib/phone.ts).
//
// `incompleteMessage` shows under the field once it loses focus with a value
// that is not a valid number; the form passes `error` to show one on submit.

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "inputMode" | "maxLength"
> & {
  value: string;
  onValueChange: (value: string) => void;
  incompleteMessage?: string;
  error?: string | null;
};

export default function PhoneInput({
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
    (touched && incompleteMessage && value.trim() && !isValidPhone(value)
      ? incompleteMessage
      : null);

  return (
    <div className="min-w-0">
      <input
        {...rest}
        type="tel"
        inputMode="tel"
        maxLength={PHONE_INPUT_MAX}
        dir={dir}
        value={value}
        aria-invalid={shown ? true : undefined}
        className={shown ? `${className} !border-red-500 dark:!border-red-400` : className}
        onChange={(event) => onValueChange(sanitizePhoneInput(event.target.value))}
        onPaste={(event) => {
          // Clean the pasted text before maxLength can cut it.
          event.preventDefault();
          const input = event.currentTarget;
          const start = input.selectionStart ?? input.value.length;
          const end = input.selectionEnd ?? input.value.length;
          onValueChange(
            sanitizePhoneInput(
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
