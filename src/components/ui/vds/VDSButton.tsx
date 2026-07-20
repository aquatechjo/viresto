"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { vds, type VDSTone } from "./tokens";

type VDSButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type VDSButtonSize = "sm" | "md" | "lg";

interface VDSButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: VDSButtonVariant;
  size?: VDSButtonSize;
  tone?: VDSTone;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

const sizeClasses: Record<VDSButtonSize, string> = {
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-sm",
};

export default function VDSButton({
  children,
  variant = "primary",
  size = "md",
  tone = "teal",
  loading = false,
  leadingIcon,
  trailingIcon,
  fullWidth = false,
  className = "",
  disabled,
  style,
  type = "button",
  ...props
}: VDSButtonProps) {
  const palette = vds.tone[tone];
  const isDisabled = disabled || loading;

  const variantStyle =
    variant === "primary"
      ? { background: palette.fg, color: "#fff", borderColor: palette.fg }
      : variant === "danger"
        ? { background: vds.tone.red.fg, color: "#fff", borderColor: vds.tone.red.fg }
        : variant === "secondary"
          ? { background: palette.soft, color: palette.fg, borderColor: palette.border }
          : { background: "transparent", color: "var(--text)", borderColor: "transparent" };

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={[
        "inline-flex items-center justify-center gap-2 border font-bold outline-none",
        "transition duration-200 focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-55",
        sizeClasses[size],
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
      style={{
        borderRadius: vds.radius.control,
        boxShadow: variant === "primary" || variant === "danger" ? vds.shadow.control : "none",
        ...variantStyle,
        ...style,
      }}
      {...props}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : leadingIcon}
      <span>{children}</span>
      {!loading && trailingIcon}
    </button>
  );
}
