"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const CHECK_INTERVAL_MS = 10 * 1000;
const ACTIVITY_PING_INTERVAL_MS = 60 * 1000;

const LAST_ACTIVITY_KEY = "viresto_last_activity";

const ACTIVITY_EVENTS = [
  "click",
  "keydown",
  "mousemove",
  "scroll",
  "touchstart",
] as const;

export default function SessionGuard() {
  const router = useRouter();
  const loggingOutRef = useRef(false);
  const lastPingRef = useRef(0);

  async function forceLogout(message?: string) {
    if (loggingOutRef.current) return;

    loggingOutRef.current = true;

    localStorage.removeItem(LAST_ACTIVITY_KEY);

    await fetch("/api/auth/logout", {
      method: "POST",
    }).catch(() => null);

    if (message) {
      toast.info(message);
    }

    window.location.replace("/login");
  }

  async function pingSessionActivity() {
    const now = Date.now();

    if (now - lastPingRef.current < ACTIVITY_PING_INTERVAL_MS) return;

    lastPingRef.current = now;

    const res = await fetch("/api/auth/session/activity", {
      method: "POST",
      cache: "no-store",
    }).catch(() => null);

    if (res && res.status === 401) {
      await forceLogout("انتهت الجلسة. يرجى تسجيل الدخول مجددًا.");
    }
  }

  useEffect(() => {
    function markActivity() {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      pingSessionActivity();
    }

    function checkIdleTimeout() {
      const lastActivity = Number(
        localStorage.getItem(LAST_ACTIVITY_KEY) || "0",
      );

      if (!lastActivity) {
        markActivity();
        return;
      }

      const inactiveFor = Date.now() - lastActivity;

      if (inactiveFor >= IDLE_TIMEOUT_MS) {
        forceLogout("تم تسجيل الخروج بسبب عدم النشاط لمدة 5 دقائق.");
      }
    }

    markActivity();

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, markActivity, { passive: true });
    }

    const interval = window.setInterval(checkIdleTimeout, CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);

      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, markActivity);
      }
    };
  }, []);

  return null;
}
