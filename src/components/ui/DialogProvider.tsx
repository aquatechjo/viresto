"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import ConfirmDialog, { type ConfirmDialogProps, type DialogInputOptions } from "@/components/ui/ConfirmDialog";

// Promise-based dialogs for the whole app (mounted once in the root layout):
//
//   const confirm = useConfirm();
//   if (await confirm({ title, message, variant: "danger" })) { ... }
//
//   const prompt = usePrompt();
//   const reason = await prompt({ title, input: { label, minLength: 5 } });
//   if (reason === null) return; // cancelled

export type ConfirmOptions = Omit<ConfirmDialogProps, "open" | "onConfirm" | "onCancel" | "input">;
export type PromptOptions = ConfirmOptions & { input: DialogInputOptions };

type Pending = {
  options: ConfirmOptions & { input?: DialogInputOptions };
  resolve: (value: string | null) => void;
};

type DialogApi = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const DialogContext = createContext<DialogApi | null>(null);

export default function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const open = useCallback((options: Pending["options"]) => {
    return new Promise<string | null>((resolve) => {
      // One dialog at a time: a new request cancels the one still open.
      pendingRef.current?.resolve(null);
      const next = { options, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  const settle = useCallback((value: string | null) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.resolve(value);
  }, []);

  const api = useMemo<DialogApi>(
    () => ({
      confirm: async (options) => (await open(options)) !== null,
      prompt: (options) => open(options),
    }),
    [open],
  );

  return (
    <DialogContext.Provider value={api}>
      {children}
      <ConfirmDialog
        {...(pending?.options ?? { title: "" })}
        open={pending !== null}
        onConfirm={(value) => settle(value)}
        onCancel={() => settle(null)}
      />
    </DialogContext.Provider>
  );
}

function useDialogApi() {
  const api = useContext(DialogContext);
  if (!api) throw new Error("useConfirm/usePrompt must be used inside <DialogProvider>");
  return api;
}

/** `await confirm({...})` resolves true on confirm, false on cancel or Esc. */
export function useConfirm() {
  return useDialogApi().confirm;
}

/** `await prompt({...})` resolves the trimmed text, or null when cancelled. */
export function usePrompt() {
  return useDialogApi().prompt;
}
