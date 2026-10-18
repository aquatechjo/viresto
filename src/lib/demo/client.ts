"use client";

import { useEffect, useState } from "react";
import { DEMO_ENDED_HEADER } from "@/lib/demo/constants";

// Client side of demo mode (src/lib/demo): the state for the dashboard
// card and banner, and the enter/exit/reset calls. The server decides
// everything; this only reflects it.

export type DemoModeState = { inDemo: boolean; available: boolean };

let cached: Promise<DemoModeState | null> | null = null;

function fetchDemoMode() {
  cached ??= fetch("/api/demo", { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) return null;
      const body = await res.json().catch(() => null);
      return (body?.data as DemoModeState | undefined) ?? null;
    })
    .catch(() => null);
  return cached;
}

/** null while loading, or when the state cannot be read (treated as "no"). */
export function useDemoMode() {
  const [state, setState] = useState<DemoModeState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchDemoMode().then((value) => {
      if (!cancelled) setState(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

type DemoAction = "enter" | "exit" | "reset";

/**
 * Calls the demo route and does a full navigation to where the server
 * sends us: the cookie changed, so every client cache must start over.
 * Returns the server's message when it refused.
 */
export async function runDemoAction(action: DemoAction): Promise<string | null> {
  const res = await fetch(`/api/demo/${action}`, { method: "POST" }).catch(() => null);
  const body = res ? await res.json().catch(() => null) : null;

  if (!res?.ok) {
    return (body?.message as string | undefined) ?? "تعذر تنفيذ الطلب. حاول مرة أخرى.";
  }

  cached = null;
  window.location.assign((body?.data?.redirect as string | undefined) ?? "/dashboard");
  return null;
}

const ENDED_FLAG = "viresto_demo_ended";

/**
 * When a sandbox ends (the office subscribed, the trial ended), the server
 * answers the next request with DEMO_ENDED and has already switched the
 * cookie back to the real session. Leave the sandbox UI for the real office
 * as soon as any response says so. Installed when this module first loads
 * in the browser (the dashboard layout imports it), before any page fetch.
 */
function installDemoEndedWatcher() {
  const originalFetch = window.fetch.bind(window);
  let fired = false;

  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const res = await originalFetch(...args);
    if (!fired && res.headers.get(DEMO_ENDED_HEADER)) {
      fired = true;
      cached = null;
      try {
        window.sessionStorage.setItem(ENDED_FLAG, "1");
      } catch {
        // Storage blocked: the redirect still happens, just without a toast.
      }
      window.location.replace("/dashboard");
    }
    return res;
  };
}

type WindowWithWatcher = Window & { __virestoDemoWatcher?: boolean };

// Once per page, even when the module is evaluated again (hot reload).
if (typeof window !== "undefined" && !(window as WindowWithWatcher).__virestoDemoWatcher) {
  (window as WindowWithWatcher).__virestoDemoWatcher = true;
  installDemoEndedWatcher();
}

/** True once, on the first load after demo mode was ended by the server. */
export function takeDemoEndedNotice() {
  try {
    if (window.sessionStorage.getItem(ENDED_FLAG) !== "1") return false;
    window.sessionStorage.removeItem(ENDED_FLAG);
    return true;
  } catch {
    return false;
  }
}
