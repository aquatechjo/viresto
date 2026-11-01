"use client";

import type { ComponentType, MouseEventHandler, ReactNode } from "react";
import Link from "next/link";

// The banner at the top of every dashboard page, the dashboard's own
// greeting included: eyebrow, title and one line of description on the
// start side, actions on the end side. Pages put PageHeaderAction buttons
// (or badges) in `actions`.

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Small line above the title, e.g. today's date or a status. */
  eyebrow?: ReactNode;
  /** Before the text, e.g. an avatar. */
  leading?: ReactNode;
  actions?: ReactNode;
  actionsLabel?: string;
  dir: "rtl" | "ltr";
  className?: string;
}

export default function PageHeader({
  title,
  description,
  eyebrow,
  leading,
  actions,
  actionsLabel,
  dir,
  className = "",
}: PageHeaderProps) {
  return (
    <section
      dir={dir}
      className={`relative min-w-0 overflow-hidden rounded-[24px] border px-4 py-4 text-start sm:px-5 ${className}`}
      style={{
        background:
          "linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 58%, var(--sidebar-dark) 100%)",
        borderColor: "rgba(255,255,255,0.12)",
      }}
    >
      {/* Logical inset (end), so it sits on the far side in both directions. */}
      <div
        aria-hidden="true"
        className="absolute -end-16 -top-24 h-48 w-48 rounded-full"
        style={{ background: "rgba(184, 115, 51, 0.17)" }}
      />

      <div className="relative flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {leading}
          <div className="min-w-0">
            {eyebrow && (
              <div className="text-[11px] font-bold text-white/60 sm:text-xs">{eyebrow}</div>
            )}
            <h1
              className={`line-clamp-2 break-words text-lg font-black text-white sm:text-xl ${
                eyebrow ? "mt-1" : ""
              }`}
            >
              {title}
            </h1>
            {description && (
              <p className="mt-1 text-xs font-semibold leading-6 text-white/75 sm:text-sm">
                {description}
              </p>
            )}
          </div>
        </div>

        {actions && (
          <div
            className="flex min-w-0 flex-wrap items-center gap-1.5 lg:shrink-0 lg:justify-end"
            aria-label={actionsLabel}
          >
            {actions}
          </div>
        )}
      </div>
    </section>
  );
}

interface PageHeaderActionProps {
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** The page's main action, in gold. One per header. */
  primary?: boolean;
  /** Square button showing the icon only; the label becomes its name. */
  iconOnly?: boolean;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  /** Tooltip, e.g. why the action is disabled. Defaults to the label. */
  title?: string;
  iconClassName?: string;
  testId?: string;
}

export function PageHeaderAction({
  label,
  icon: Icon,
  primary = false,
  iconOnly = false,
  href,
  onClick,
  disabled = false,
  title,
  iconClassName = "",
  testId,
}: PageHeaderActionProps) {
  const className = `inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
    iconOnly ? "w-9" : "px-3"
  } ${primary ? "hover:brightness-110" : "border text-white hover:bg-white/15"}`;
  const style = primary
    ? { background: "var(--gold)", color: "#102d2e" }
    : { background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.16)" };
  const content = (
    <>
      <Icon className={`${iconOnly ? "h-4 w-4" : "h-3.5 w-3.5"} ${iconClassName}`} />
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </>
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={className} style={style} title={title ?? label} data-testid={testId}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      className={className}
      style={style}
      data-testid={testId}
    >
      {content}
    </button>
  );
}
