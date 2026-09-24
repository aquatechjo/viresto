"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getCurrentUser } from "@/lib/client-session";
import { translations } from "@/lib/i18n";
import { useLocale } from "@/lib/useLocale";
import {
  SESSION_EXPIRING_EVENT,
  draftStorageKey,
  purgeDrafts,
  readDraft,
  removeDraft,
  writeDraft,
} from "@/lib/form-draft";

const SAVE_DEBOUNCE_MS = 400;

// True once the page is going away (idle logout redirect or a full
// navigation). Forms closing because the page is unloading keep their
// draft; forms closed by the user (cancel or successful save) drop it.
let pageUnloading = false;

if (typeof window !== "undefined") {
  window.addEventListener(SESSION_EXPIRING_EVENT, () => {
    pageUnloading = true;
  });
  window.addEventListener("pagehide", () => {
    pageUnloading = true;
  });
}

type UseFormDraftOptions<T> = {
  /** Stable id for the form, e.g. "case-create" or `case-edit:${id}`. */
  formKey: string;
  value: T;
  /** Applies a restored draft (or the pre-restore snapshot on discard). */
  onRestore: (value: T) => void;
  /** Whether the form is open. Defaults to true for always-mounted forms. */
  active?: boolean;
};

/**
 * Keeps unsaved form input in sessionStorage so it survives an idle logout
 * and is restored after signing back in (same tab). Drafts are scoped to
 * the signed-in user, expire after 24 hours, never include sensitive
 * fields, and are dropped when the form is cancelled or saved.
 */
export function useFormDraft<T>({
  formKey,
  value,
  onRestore,
  active = true,
}: UseFormDraftOptions<T>) {
  const { locale } = useLocale();
  const t = translations[locale];

  const [userId, setUserId] = useState<string | null>(null);

  const tRef = useRef(t);
  const valueRef = useRef(value);
  const onRestoreRef = useRef(onRestore);
  const baselineRef = useRef("");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    tRef.current = t;
    valueRef.current = value;
    onRestoreRef.current = onRestore;
  });

  useEffect(() => {
    let cancelled = false;

    void getCurrentUser()
      .then((result) => {
        const id = result.user?.id;
        if (cancelled || !id) return;

        purgeDrafts(window.sessionStorage, id);
        setUserId(id);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const liveKey = active && userId ? draftStorageKey(userId, formKey) : null;

  // Activation: restore a saved draft. Deactivation: drop it, unless the
  // page is unloading (then flush the latest input instead).
  useEffect(() => {
    if (!liveKey) return;

    const storage = window.sessionStorage;
    const snapshot = valueRef.current;
    baselineRef.current = JSON.stringify(snapshot);

    const draft = readDraft<T>(storage, liveKey);

    if (draft !== null && JSON.stringify(draft) !== baselineRef.current) {
      onRestoreRef.current(draft);

      toast.info(tRef.current.drafts.restored, {
        action: {
          label: tRef.current.drafts.discard,
          onClick: () => {
            removeDraft(storage, liveKey);
            onRestoreRef.current(snapshot);
          },
        },
      });
    }

    function flush() {
      const serialized = JSON.stringify(valueRef.current);

      if (serialized !== baselineRef.current) {
        writeDraft(storage, liveKey!, valueRef.current);
      }
    }

    window.addEventListener(SESSION_EXPIRING_EVENT, flush);
    window.addEventListener("pagehide", flush);

    return () => {
      window.removeEventListener(SESSION_EXPIRING_EVENT, flush);
      window.removeEventListener("pagehide", flush);

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (pageUnloading) {
        flush();
      } else {
        removeDraft(storage, liveKey);
      }
    };
  }, [liveKey]);

  // Debounced save while the form is open.
  useEffect(() => {
    if (!liveKey) return;

    const storage = window.sessionStorage;
    const serialized = JSON.stringify(value);

    if (timerRef.current !== null) window.clearTimeout(timerRef.current);

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;

      if (serialized === baselineRef.current) {
        removeDraft(storage, liveKey);
      } else {
        writeDraft(storage, liveKey, value);
      }
    }, SAVE_DEBOUNCE_MS);
  }, [liveKey, value]);
}
