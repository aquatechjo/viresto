"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  startNavigationFeedback,
  subscribeToNavigationStart,
} from "@/lib/navigation-feedback";

const CORE_DASHBOARD_ROUTES = [
  "/dashboard",
  "/dashboard/clients",
  "/dashboard/cases",
  "/dashboard/documents",
  "/dashboard/appointments",
  "/dashboard/tasks",
] as const;

type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformation;
};

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export default function NavigationPerformance() {
  const pathname = usePathname();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const activeRef = useRef(false);
  const previousPathRef = useRef(pathname);
  const intervalRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const safetyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return subscribeToNavigationStart(() => {
      if (activeRef.current) return;

      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }

      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }

      if (safetyTimerRef.current) {
        window.clearTimeout(safetyTimerRef.current);
      }

      activeRef.current = true;
      setVisible(true);
      setProgress(14);

      window.requestAnimationFrame(() => {
        setProgress(58);
      });

      intervalRef.current = window.setInterval(() => {
        setProgress((current) => {
          if (current >= 88) return current;
          return Math.min(88, current + Math.max(2, (88 - current) * 0.18));
        });
      }, 320);

      safetyTimerRef.current = window.setTimeout(() => {
        activeRef.current = false;

        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        setVisible(false);
        setProgress(0);
        safetyTimerRef.current = null;
      }, 8_000);
    });
  }, []);

  useEffect(() => {
    if (previousPathRef.current === pathname) return;

    previousPathRef.current = pathname;

    if (!activeRef.current) return;

    activeRef.current = false;

    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (safetyTimerRef.current) {
      window.clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }

    setProgress(100);

    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
      hideTimerRef.current = null;
    }, 180);
  }, [pathname]);



  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) return;

      const anchor = target.closest<HTMLAnchorElement>("a[href]");

      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      const current = new URL(window.location.href);

      if (
        destination.origin !== current.origin ||
        (destination.pathname === current.pathname &&
          destination.search === current.search)
      ) {
        return;
      }

      startNavigationFeedback();
    }

    document.addEventListener("click", handleDocumentClick);

    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, []);

  useEffect(() => {
    const navigatorWithConnection = navigator as NavigatorWithConnection;
    const connection = navigatorWithConnection.connection;

    if (
      connection?.saveData ||
      connection?.effectiveType === "slow-2g" ||
      connection?.effectiveType === "2g"
    ) {
      return;
    }

    const windowWithIdleCallback = window as WindowWithIdleCallback;
    const timers: number[] = [];

    function warmRoutes() {
      CORE_DASHBOARD_ROUTES.filter((route) => route !== pathname).forEach(
        (route, index) => {
          timers.push(
            window.setTimeout(() => {
              router.prefetch(route);
            }, index * 280),
          );
        },
      );
    }

    let idleHandle: number | null = null;

    if (windowWithIdleCallback.requestIdleCallback) {
      idleHandle = windowWithIdleCallback.requestIdleCallback(warmRoutes, {
        timeout: 1600,
      });
    } else {
      timers.push(window.setTimeout(warmRoutes, 700));
    }

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));

      if (
        idleHandle !== null &&
        windowWithIdleCallback.cancelIdleCallback
      ) {
        windowWithIdleCallback.cancelIdleCallback(idleHandle);
      }
    };
  }, [pathname, router]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }

      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }

      if (safetyTimerRef.current) {
        window.clearTimeout(safetyTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[120] h-[3px] overflow-hidden transition-opacity duration-150 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className="h-full rounded-e-full bg-copper-400 shadow-[0_0_16px_rgba(184,115,51,0.65)] transition-[width] duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
