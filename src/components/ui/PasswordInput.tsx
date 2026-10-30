"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

// A password field with its own show/hide button. Every instance keeps its
// own visibility, so showing one field never reveals another (e.g. the
// confirmation). It changes only the input type: value, validation and
// submission stay with the page.

type Tone = "input" | "copper";

const TOGGLE_TONES: Record<Tone, string> = {
  // Fields using the .input class (login, register, settings).
  input:
    "h-8 w-9 rounded-lg bg-[#f4fbf9] text-[#0f5253] shadow-sm ring-1 ring-[#b9d8d3] hover:bg-[#e5f5f1] hover:text-[#083b3c] focus-visible:ring-2 focus-visible:ring-teal-500/50 dark:bg-[#123f40] dark:text-emerald-100 dark:ring-teal-700/80 dark:hover:bg-[#185354] dark:hover:text-white",
  // The dark copper pages (join team, reset password).
  copper:
    "h-9 w-9 rounded-xl text-copper-100/70 hover:bg-white/10 hover:text-copper-50 focus-visible:ring-2 focus-visible:ring-copper-300/50",
};

export type PasswordInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  tone?: Tone;
  /** The button's side: left by default, the end of an RTL field. */
  toggleSide?: "left" | "right";
  showLabel?: string;
  hideLabel?: string;
};

export default function PasswordInput({
  tone = "input",
  toggleSide = "left",
  showLabel = "إظهار كلمة المرور",
  hideLabel = "إخفاء كلمة المرور",
  className = "",
  ...inputProps
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const label = visible ? hideLabel : showLabel;
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <input
        {...inputProps}
        type={visible ? "text" : "password"}
        // Keeps LatinDigitsInputBoundary off the value while it is shown.
        data-password-field=""
        className={`${className} ${toggleSide === "left" ? "!pl-11" : "!pr-11"}`}
      />

      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        className={`absolute top-1/2 z-20 flex -translate-y-1/2 items-center justify-center transition-colors focus-visible:outline-none ${TOGGLE_TONES[tone]} ${
          toggleSide === "left" ? "left-2.5" : "right-2.5"
        }`}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
      </button>
    </div>
  );
}
