"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/useLocale";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnOverlay?: boolean;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  closeOnOverlay = true,
}: Props) {
  const { isRtl } = useLocale();

  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handler);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handler);
    };
  }, [open, onClose]);

  if (!open) return null;

  const maxW = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }[size];

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={closeOnOverlay ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div
        className={cn(
          "relative z-[110] w-full",
          maxW,
          "hide-scrollbar max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border p-5 shadow-2xl outline-none animate-in zoom-in-95 slide-in-from-bottom-3 duration-200",
        )}
        style={{
          background: "var(--card)",
          borderColor: "var(--border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2
            id="modal-title"
            className={`text-base font-black ${
              isRtl ? "text-right" : "text-left"
            }`}
            style={{ color: "var(--text)" }}
          >
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label={isRtl ? "إغلاق النافذة" : "Close modal"}
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm transition-all hover:scale-105"
            style={{
              background: "var(--input-bg)",
              color: "var(--text-3)",
            }}
          >
            ✕
          </button>
        </div>

        {children}
      </div>
    </div>,
    document.body,
  );
}
