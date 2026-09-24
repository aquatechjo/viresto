"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { invalidateCurrentUser } from "@/lib/client-session";
import { invalidateTenantWriteAccessCache } from "@/lib/tenant-write-access-cache";
import { translations } from "@/lib/i18n";
import { SESSION_EXPIRING_EVENT, clearAllDrafts } from "@/lib/form-draft";
import { useLocale } from "@/lib/useLocale";
import {
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_IDLE_WARNING_MS,
} from "@/lib/session-policy";

const CHECK_INTERVAL_MS = 1_000;
const ACTIVITY_PING_INTERVAL_MS = 60 * 1000;
const PING_DEDUPE_MS = 2_000;
const ACTIVITY_SAMPLE_INTERVAL_MS = 1_000;
const ACTIVITY_STORAGE_INTERVAL_MS = 5_000;

const LAST_ACTIVITY_KEY = "viresto_last_activity";

// Real user input only. mousemove is deliberately excluded: incidental
// pointer drift over an unattended screen must not keep a session alive.
// Listeners are registered in the capture phase so scrolling inside panels
// (case files, tables, drawers) counts, not just window scroll.
const ACTIVITY_EVENTS = ["click", "keydown", "scroll", "touchstart"] as const;

export default function SessionGuard() {
  const { locale, isRtl } = useLocale();
  const t = translations[locale];

  const tRef = useRef(t);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const stayButtonRef = useRef<HTMLButtonElement>(null);

  const loggingOutRef = useRef(false);
  const lastPingRef = useRef(0);
  const pingTimerRef = useRef<number | null>(null);
  const pendingActivityRef = useRef(false);
  const lastActivityRef = useRef(0);
  const lastActivitySampleRef = useRef(0);
  const lastActivityWriteRef = useRef(0);

  const forceLogout = useCallback(async (message?: string, manual = false) => {
    if (loggingOutRef.current) return;

    loggingOutRef.current = true;

    if (manual) {
      // The user chose to leave: nothing to come back to.
      clearAllDrafts(window.sessionStorage);
    } else {
      // Expired: let open forms persist their input before we redirect.
      window.dispatchEvent(new Event(SESSION_EXPIRING_EVENT));
    }

    localStorage.removeItem(LAST_ACTIVITY_KEY);
    invalidateCurrentUser();
    invalidateTenantWriteAccessCache();

    await fetch("/api/auth/logout", {
      method: "POST",
    }).catch(() => null);

    if (message) {
      toast.info(message);
    }

    window.location.replace("/login");
  }, []);

  const sendPing = useCallback(async () => {
    lastPingRef.current = Date.now();
    pendingActivityRef.current = false;

    const res = await fetch("/api/auth/session/activity", {
      method: "POST",
      cache: "no-store",
    }).catch(() => null);

    if (res && res.status === 401) {
      await forceLogout(tRef.current.session.expired);
    }
  }, [forceLogout]);

  // Leading ping, plus one trailing ping at the end of the throttle window
  // if there was activity inside it. Without the trailing ping the server's
  // lastActivityAt could lag the client's by up to a full interval, so the
  // server would expire the session while the client still shows time left.
  const pingSessionActivity = useCallback(
    (force = false) => {
      const sinceLastPing = Date.now() - lastPingRef.current;

      // A click on "stay signed in" is itself activity, so the same gesture
      // would otherwise send the forced ping twice.
      if (force && sinceLastPing < PING_DEDUPE_MS) return;

      if (force || sinceLastPing >= ACTIVITY_PING_INTERVAL_MS) {
        if (pingTimerRef.current !== null) {
          window.clearTimeout(pingTimerRef.current);
          pingTimerRef.current = null;
        }

        void sendPing();
        return;
      }

      pendingActivityRef.current = true;

      if (pingTimerRef.current === null) {
        pingTimerRef.current = window.setTimeout(() => {
          pingTimerRef.current = null;

          if (pendingActivityRef.current) {
            void sendPing();
          }
        }, ACTIVITY_PING_INTERVAL_MS - sinceLastPing);
      }
    },
    [sendPing],
  );

  const recordActivity = useCallback(
    (force = false) => {
      const now = Date.now();

      if (
        !force &&
        now - lastActivitySampleRef.current < ACTIVITY_SAMPLE_INTERVAL_MS
      ) {
        return;
      }

      lastActivitySampleRef.current = now;
      lastActivityRef.current = now;

      if (
        force ||
        now - lastActivityWriteRef.current >= ACTIVITY_STORAGE_INTERVAL_MS
      ) {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
        lastActivityWriteRef.current = now;
      }

      pingSessionActivity(force);
    },
    [pingSessionActivity],
  );

  useEffect(() => {
    function handleActivity() {
      recordActivity();
    }

    function checkIdleTimeout() {
      const storedActivity = Number(
        localStorage.getItem(LAST_ACTIVITY_KEY) || "0",
      );
      const lastActivity = Math.max(lastActivityRef.current, storedActivity);

      if (!lastActivity) {
        recordActivity(true);
        return;
      }

      const inactiveFor = Date.now() - lastActivity;

      if (inactiveFor >= SESSION_IDLE_TIMEOUT_MS) {
        setSecondsLeft(null);
        void forceLogout(tRef.current.session.idleLoggedOut);
        return;
      }

      if (inactiveFor >= SESSION_IDLE_TIMEOUT_MS - SESSION_IDLE_WARNING_MS) {
        setSecondsLeft(
          Math.ceil((SESSION_IDLE_TIMEOUT_MS - inactiveFor) / 1000),
        );
      } else {
        setSecondsLeft(null);
      }
    }

    recordActivity(true);

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, handleActivity, {
        capture: true,
        passive: true,
      });
    }

    const interval = window.setInterval(checkIdleTimeout, CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);

      if (pingTimerRef.current !== null) {
        window.clearTimeout(pingTimerRef.current);
        pingTimerRef.current = null;
      }

      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, handleActivity, {
          capture: true,
        });
      }
    };
  }, [forceLogout, recordActivity]);

  const warningOpen = secondsLeft !== null;

  useEffect(() => {
    if (warningOpen) {
      stayButtonRef.current?.focus();
    }
  }, [warningOpen]);

  function staySignedIn() {
    recordActivity(true);
    setSecondsLeft(null);
  }

  if (!warningOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 300 }}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-warning-title"
        aria-describedby="session-warning-body"
        dir={isRtl ? "rtl" : "ltr"}
        className="modal modal-sm text-start"
      >
        <h2 id="session-warning-title" className="modal-title">
          {t.session.warningTitle}
        </h2>

        <p
          id="session-warning-body"
          className="mt-2 text-sm leading-7"
          style={{ color: "var(--text-2)" }}
        >
          {t.session.warningBody}{" "}
          <strong
            dir="ltr"
            className="tabular-nums"
            style={{ color: "var(--text)" }}
          >
            {secondsLeft}
          </strong>{" "}
          {t.session.seconds}
        </p>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn btn-secondary min-h-11"
            onClick={() => void forceLogout(undefined, true)}
          >
            {t.session.signOutNow}
          </button>

          <button
            ref={stayButtonRef}
            type="button"
            className="btn btn-primary min-h-11"
            onClick={staySignedIn}
          >
            {t.session.staySignedIn}
          </button>
        </div>
      </div>
    </div>
  );
}
