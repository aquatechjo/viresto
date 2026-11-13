// Motion for the subscriptions page (/dashboard/billing) only.
//
// The rest of the app keeps its 0.15s entrance budget
// (tests/unit/entrance-motion.test.ts). This page is the one scoped
// exception (user decision, 2026-11-13): it is where an office decides to
// pay, and its motion should be noticed. tests/unit/entrance-motion.test.ts
// fails if anything outside src/components/billing or
// src/app/dashboard/billing imports this module.
//
// Elegant, not playful: ease-out curves, no overshoot, transform and
// opacity only. Every user of these values must honour
// prefers-reduced-motion (instant final state).

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Section entrance: fade + 16px rise, 0.45s, 80ms apart. */
export const BILLING_ENTRANCE = {
  duration: 0.45,
  rise: 16,
  stagger: 0.08,
} as const;

/** The toggle's active pill: a spring with no overshoot (bounce 0). */
export const TOGGLE_SPRING = { type: "spring", bounce: 0, duration: 0.42 } as const;

/** Price count-up on first view, and the trial days counting down in. */
export const COUNT_DURATION = 0.9;

/** Success confetti pieces. */
export const CONFETTI_PIECES = 40;

/** Entrance props for the n-th section of the page (0-based). */
export function entrance(index: number, reduce: boolean | null) {
  if (reduce) return { initial: false as const };
  return {
    initial: { opacity: 0, y: BILLING_ENTRANCE.rise },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: BILLING_ENTRANCE.duration,
      delay: index * BILLING_ENTRANCE.stagger,
      ease: EASE_OUT,
    },
  };
}

/** The same entrance, played when the section scrolls into view. */
export function revealOnScroll(reduce: boolean | null) {
  if (reduce) return { initial: false as const };
  return {
    initial: { opacity: 0, y: BILLING_ENTRANCE.rise },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: BILLING_ENTRANCE.duration, ease: EASE_OUT },
  };
}

/**
 * A formatted price ("$1,190", maybe wrapped in bidi isolates) split into
 * what comes before the number, the number, and what comes after, so the
 * number can count up while the currency sign stays put.
 */
export function splitPrice(formatted: string): { before: string; value: number; after: string; decimals: number } | null {
  const match = formatted.match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)(\D*)$/);
  if (!match) return null;
  const digits = match[2].replace(/,/g, "");
  const decimals = digits.includes(".") ? digits.split(".")[1].length : 0;
  return { before: match[1], value: Number(digits), after: match[3], decimals };
}

/** The number written back with thousands separators and Latin digits. */
export function formatCount(value: number, decimals: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
