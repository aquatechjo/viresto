"use client";

const NAVIGATION_START_EVENT = "viresto-navigation-start";

export function startNavigationFeedback() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new Event(NAVIGATION_START_EVENT));
}

export function subscribeToNavigationStart(listener: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener(NAVIGATION_START_EVENT, listener);

  return () => {
    window.removeEventListener(NAVIGATION_START_EVENT, listener);
  };
}
