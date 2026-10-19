"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useLocale } from "@/lib/useLocale";

// The app's confirmation and input dialog, in place of the browser's
// confirm() and prompt() (ESLint `no-alert` keeps those out). Use it through
// useConfirm() / usePrompt() from DialogProvider rather than directly.
//
// - variant "danger": red confirm button and a warning icon.
// - requireText: the confirm button stays disabled until this exact text
//   (an office or user name) is typed, for irreversible high-impact actions.
// - input: a text field whose value is returned (the prompt() replacement).
// Keyboard: Esc cancels (Modal), Enter confirms (Ctrl/Cmd+Enter in a
// multi-line field), Tab stays inside the dialog, focus returns afterwards.

export type ConfirmVariant = "default" | "danger";

export type DialogInputOptions = {
  label: string;
  placeholder?: string;
  defaultValue?: string;
  minLength?: number;
  maxLength?: number;
  multiline?: boolean;
};

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  requireText?: string;
  input?: DialogInputOptions;
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = "default",
  requireText,
  input,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { locale } = useLocale();
  const isArabic = locale === "ar";
  const fieldId = useId();
  const typedId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [typed, setTyped] = useState("");
  const [value, setValue] = useState(input?.defaultValue ?? "");

  // Fresh fields each time it opens; focus the first field (or the confirm
  // button), and give focus back to whatever had it when it closes.
  useEffect(() => {
    if (!open) return;
    setTyped("");
    setValue(input?.defaultValue ?? "");
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => {
      (firstFieldRef.current ?? confirmRef.current)?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      previous?.focus?.();
    };
  }, [open, input?.defaultValue]);

  // Focus trap on the document, not this subtree: Modal's close button sits
  // outside it, and Shift+Tab from there must not leave the dialog.
  useEffect(() => {
    if (!open) return;
    function trapTab(event: globalThis.KeyboardEvent) {
      if (event.key !== "Tab") return;
      const dialog = rootRef.current?.closest('[role="dialog"]');
      if (!dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !active || !dialog.contains(active);
      if (event.shiftKey && (outside || active === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (outside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", trapTab);
    return () => document.removeEventListener("keydown", trapTab);
  }, [open]);

  const danger = variant === "danger";
  const trimmed = value.trim();
  const minLength = input?.minLength ?? 0;
  const inputOk = !input || trimmed.length >= Math.max(minLength, 1);
  const typedOk = !requireText || typed.trim() === requireText.trim();
  const canConfirm = inputOk && typedOk;

  function submit() {
    if (canConfirm) onConfirm(trimmed);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    const target = event.target as HTMLElement;
    // A focused button acts on its own (Cancel stays Cancel).
    if (target.tagName === "BUTTON") return;
    if (target.tagName === "TEXTAREA" && !(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    submit();
  }

  const fieldClass =
    "input w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60";

  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <div ref={rootRef} onKeyDown={handleKeyDown} data-testid="confirm-dialog" data-variant={variant}>
        <div className="flex items-start gap-3">
          {danger && (
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-red-500/10 text-red-600 dark:bg-red-400/15 dark:text-red-300"
              aria-hidden
            >
              <AlertTriangle className="h-5 w-5" />
            </span>
          )}
          {message && (
            <div dir="auto" className="min-w-0 text-start text-sm font-semibold leading-relaxed" style={{ color: "var(--text-2)" }}>
              {message}
            </div>
          )}
        </div>

        {input && (
          <div className="mt-4 space-y-1.5">
            <label htmlFor={fieldId} className="block text-sm font-bold" style={{ color: "var(--text)" }}>
              {input.label}
            </label>
            {input.multiline ? (
              <textarea
                id={fieldId}
                ref={firstFieldRef}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={input.placeholder}
                maxLength={input.maxLength}
                rows={3}
                className={`${fieldClass} resize-none`}
              />
            ) : (
              <input
                id={fieldId}
                ref={firstFieldRef}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={input.placeholder}
                maxLength={input.maxLength}
                autoComplete="off"
                className={fieldClass}
              />
            )}
            {minLength > 1 && (
              <p className="text-xs font-semibold" style={{ color: "var(--text-3)" }}>
                {isArabic ? `${minLength} أحرف على الأقل` : `At least ${minLength} characters`}
              </p>
            )}
          </div>
        )}

        {requireText && (
          <div className="mt-4 space-y-1.5">
            <label htmlFor={typedId} className="block text-sm font-bold" style={{ color: "var(--text)" }}>
              {isArabic ? "للتأكيد، اكتب: " : "To confirm, type: "}
              <span dir="auto" className="rounded-md px-1.5 py-0.5 font-black" style={{ background: "var(--input-bg)" }}>
                {requireText}
              </span>
            </label>
            <input
              id={typedId}
              ref={input ? undefined : firstFieldRef}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={requireText}
              autoComplete="off"
              spellCheck={false}
              dir="auto"
              data-testid="confirm-dialog-typed"
              className={fieldClass}
            />
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            data-testid="confirm-dialog-cancel"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2 text-sm font-bold transition hover:bg-[var(--input-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
          >
            {cancelLabel ?? (isArabic ? "إلغاء" : "Cancel")}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={submit}
            disabled={!canConfirm}
            data-testid="confirm-dialog-confirm"
            className={`inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 ${
              danger
                ? "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/60"
                : "bg-[var(--landing-copper)] text-[var(--landing-canvas)] hover:bg-[var(--landing-copper-hover)] focus-visible:ring-teal-500/60"
            }`}
          >
            {confirmLabel ?? (isArabic ? "تأكيد" : "Confirm")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
