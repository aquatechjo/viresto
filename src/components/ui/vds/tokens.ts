import type { StatusTone } from "@/lib/theme/status";

// The VDS components' design values. Colors are not defined here any more:
// each VDS tone is one of the app's color families (src/lib/theme/tokens.ts,
// the --tone-* custom properties of globals.css), so VDS badges, icons and
// buttons follow the light and dark themes like the rest of the app
// (color plan, batch 2b, 2026-11-07).

export type VDSTone = "teal" | "blue" | "cyan" | "gold" | "purple" | "emerald" | "red" | "slate";

/** The color family behind each VDS tone name (the names stay for callers). */
export const VDS_TONE_FAMILY: Record<VDSTone, StatusTone | "purple"> = {
  teal: "green",
  emerald: "green",
  blue: "blue",
  cyan: "blue",
  gold: "amber",
  purple: "purple",
  red: "red",
  slate: "gray",
};

function family(name: StatusTone | "purple") {
  return {
    /** Text and icons on the soft background or on a card. */
    fg: `var(--tone-${name}-fg)`,
    soft: `var(--tone-${name}-bg)`,
    border: `var(--tone-${name}-border)`,
    /** A fill that carries white text (solid buttons): the same in both themes. */
    solid: `var(--tone-${name}-solid)`,
  };
}

export const vds = {
  radius: {
    card: "24px",
    surface: "20px",
    control: "16px",
    icon: "18px",
    pill: "999px",
  },
  shadow: {
    card: "0 10px 30px rgba(15, 61, 62, 0.07)",
    control: "0 8px 20px rgba(15, 61, 62, 0.10)",
    hover: "0 18px 42px rgba(15, 61, 62, 0.12)",
    elevated: "0 24px 70px rgba(15, 61, 62, 0.16)",
  },
  motion: {
    fast: 160,
    standard: 200,
    slow: 300,
  },
  spacing: {
    section: "24px",
    card: "20px",
    compact: "12px",
  },
  tone: Object.fromEntries(
    (Object.keys(VDS_TONE_FAMILY) as VDSTone[]).map((tone) => [tone, family(VDS_TONE_FAMILY[tone])]),
  ) as Record<VDSTone, ReturnType<typeof family>>,
} as const;
