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
  "text-3": "#718581",
  muted: "#718581",
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
