// The Viresto palette: the colors of the app (the dashboard) in its two
// themes. The app is the reference; the landing page, printouts, PDF and
// Excel exports, charts, emails and the web manifest read their colors
// from here (color plan, approved 2026-11-07).
//
// globals.css defines the same values as CSS custom properties for the
// app itself; tests/unit/theme-tokens.test.ts fails if the two differ.
// Each key below is the custom property without its "--".

export type ThemeMode = "light" | "dark";

const light = {
  // Backgrounds and surfaces
  bg: "#f3f7f6",
  surface: "#ffffff",
  "surface-2": "#f6f9f8",
  card: "#ffffff",
  "card-2": "#f6f9f8",
  "card-bg": "#ffffff",
  "input-bg": "#ffffff",
  overlay: "rgba(15, 35, 34, 0.38)",
  // Borders
  border: "#dbe6e2",
  "border-dark": "#c6d7d2",
  // Text
  text: "#17302e",
  "text-2": "#36534f",
  "text-3": "#5f7470",
  muted: "#5f7470",
  // Copper (primary accent and primary button)
  gold: "#a9652f",
  "gold-hover": "#8e5121",
  "gold-soft": "#f8eee5",
  "gold-border": "#e8cbb1",
  "accent-text": "#082c2d",
  "accent-fill": "#082c2d",
  // Semantic
  success: "#082c2d",
  warning: "#b45309",
  danger: "#dc2626",
  info: "#1d4ed8",
  "warning-text": "#fbbf24",
  // Soft tone backgrounds (badges, alerts)
  "green-soft": "#e9f5ef",
  "amber-soft": "#fff4df",
  "red-soft": "#fef0ef",
  "blue-soft": "#eaf1fb",
  "purple-soft": "#f2ecfb",
  "gray-soft": "#f0f3f5",
  // Status tones: text, background, border (status.ts maps statuses)
  "tone-green-fg": "#082c2d",
  "tone-green-bg": "#e9f5ef",
  "tone-green-border": "rgba(15, 61, 62, 0.18)",
  "tone-amber-fg": "#92400e",
  "tone-amber-bg": "#fff4df",
  "tone-amber-border": "rgba(217, 119, 6, 0.2)",
  "tone-red-fg": "#b91c1c",
  "tone-red-bg": "#fef0ef",
  "tone-red-border": "rgba(220, 38, 38, 0.2)",
  "tone-blue-fg": "#1d4ed8",
  "tone-blue-bg": "#eaf1fb",
  "tone-blue-border": "rgba(37, 99, 235, 0.2)",
  "tone-purple-fg": "#6d28d9",
  "tone-purple-bg": "#f2ecfb",
  "tone-purple-border": "rgba(109, 40, 217, 0.2)",
  "tone-gray-fg": "#4b5563",
  "tone-gray-bg": "#f0f3f5",
  "tone-gray-border": "rgba(107, 114, 128, 0.2)",
  "tone-green-solid": "#0f766e",
  "tone-amber-solid": "#b45309",
  "tone-red-solid": "#b91c1c",
  "tone-blue-solid": "#1d4ed8",
  "tone-purple-solid": "#6d28d9",
  "tone-gray-solid": "#4b5563",
  // Text on a copper fill (primary buttons)
  "on-gold": "#ffffff",
  // Chart marks: 3:1 on a card
  "chart-green": "#0f766e",
  "chart-amber": "#b45309",
  "chart-orange": "#c2410c",
  "chart-red": "#dc2626",
  "chart-blue": "#2563eb",
  "chart-gray": "#64748b",
  "chart-gray-light": "#8794a6",
  "chart-copper": "#a9652f",
  // Chrome: sidebar and page-header banners
  sidebar: "#082c2d",
  "sidebar-dark": "#041819",
  "sidebar-hover": "#185354",
  "sidebar-text": "#f8fbfa",
  "sidebar-muted": "rgba(216, 240, 236, 0.74)",
} as const;

export type ThemeTokenName = keyof typeof light;

const dark: Record<ThemeTokenName, string> = {
  bg: "#041819",
  surface: "#0b292a",
  "surface-2": "#103334",
  card: "#0b292a",
  "card-2": "#103334",
  "card-bg": "#0b292a",
  "input-bg": "#061b1c",
  overlay: "rgba(2, 12, 13, 0.76)",
  border: "#286061",
  "border-dark": "#286061",
  text: "#f0fdf4",
  "text-2": "rgba(220, 252, 231, 0.88)",
  "text-3": "rgba(187, 247, 208, 0.76)",
  muted: "#86aaa6",
  gold: "#b87333",
  "gold-hover": "#cc8e55",
  "gold-soft": "#3a2818",
  "gold-border": "#7d4925",
  "accent-text": "#dfb184",
  "accent-fill": "#185354",
  success: "#a7f3d0",
  warning: "#b45309",
  danger: "#dc2626",
  info: "#1d4ed8",
  "warning-text": "#fbbf24",
  "green-soft": "#123b3c",
  "amber-soft": "#3a2818",
  "red-soft": "#330f0f",
  "blue-soft": "#0c1e40",
  "purple-soft": "#1e1640",
  "gray-soft": "#102d2e",
  "tone-green-fg": "#a7f3d0",
  "tone-green-bg": "#123b3c",
  "tone-green-border": "rgba(110, 231, 183, 0.35)",
  "tone-amber-fg": "#fdba74",
  "tone-amber-bg": "#3a2818",
  "tone-amber-border": "rgba(251, 146, 60, 0.35)",
  "tone-red-fg": "#fca5a5",
  "tone-red-bg": "#330f0f",
  "tone-red-border": "rgba(248, 113, 113, 0.35)",
  "tone-blue-fg": "#93c5fd",
  "tone-blue-bg": "#0c1e40",
  "tone-blue-border": "rgba(96, 165, 250, 0.35)",
  "tone-purple-fg": "#c4b5fd",
  "tone-purple-bg": "#1e1640",
  "tone-purple-border": "rgba(167, 139, 250, 0.35)",
  "tone-gray-fg": "#cbd5e1",
  "tone-gray-bg": "#102d2e",
  "tone-gray-border": "rgba(148, 163, 184, 0.35)",
  "tone-green-solid": "#0f766e",
  "tone-amber-solid": "#b45309",
  "tone-red-solid": "#b91c1c",
  "tone-blue-solid": "#1d4ed8",
  "tone-purple-solid": "#6d28d9",
  "tone-gray-solid": "#4b5563",
  "on-gold": "#041819",
  "chart-green": "#14b8a6",
  "chart-amber": "#f59e0b",
  "chart-orange": "#f97316",
  "chart-red": "#ef4444",
  "chart-blue": "#3b82f6",
  "chart-gray": "#94a3b8",
  "chart-gray-light": "#cbd5e1",
  "chart-copper": "#b87333",
  sidebar: "#041819",
  "sidebar-dark": "#020e0f",
  "sidebar-hover": "#082c2d",
  "sidebar-text": "#f8fbfa",
  "sidebar-muted": "rgba(216, 240, 236, 0.74)",
};

export const themeTokens: Record<ThemeMode, Record<ThemeTokenName, string>> = {
  light,
  dark,
};

/**
 * Always-dark brand surfaces, the same in both themes: the landing page,
 * the login page and always-dark popovers (the --landing-* properties).
 */
export const brandDark = {
  "landing-canvas": "#041819",
  "landing-shell": "#082c2d",
  "landing-surface": "#0b292a",
  "landing-surface-2": "#103334",
  "landing-surface-hover": "#185354",
  "landing-border": "#1c494a",
  "landing-border-strong": "#286061",
  "landing-copper": "#b87333",
  "landing-copper-hover": "#cc8e55",
  "brand-canvas-deep": "#020e0f",
} as const;
