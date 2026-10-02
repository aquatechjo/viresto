// Theme handling (no next-themes): Tailwind `darkMode: "class"` plus the CSS
// variables in globals.css (`:root` dark, `:root:not(.dark)` light). The
// user's choice lives in localStorage["theme"] (ThemeToggle writes it);
// without one the OS preference is used.
//
// Public pages always render dark whatever that choice is (their palettes
// are built for a dark canvas). They never read or write the stored
// choice, so the dashboard keeps the user's own theme.

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

// Exact pathnames: the landing page and every public (signed-out) page.
// The dashboard and /admin follow the user's theme.
export const FORCED_DARK_PATHS: readonly string[] = [
  "/",
  "/pricing",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/join-team",
  "/privacy",
  "/terms",
  "/subscription-policy",
];

export function isForcedDarkPath(pathname: string) {
  return FORCED_DARK_PATHS.includes(pathname);
}

export function resolveTheme(
  pathname: string,
  stored: string | null,
  osPrefersDark: boolean,
): Theme {
  if (isForcedDarkPath(pathname)) return "dark";
  if (stored === "light" || stored === "dark") return stored;
  return osPrefersDark ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = "viresto";
  root.style.colorScheme = theme;
}

// Inline in the root layout, before any content paints: the same decision
// as resolveTheme. On a forced-dark page it touches neither localStorage
// nor the OS preference.
export const THEME_INIT_SCRIPT = `(function(){try{var root=document.documentElement;var theme;if(${JSON.stringify(FORCED_DARK_PATHS)}.indexOf(location.pathname)!==-1){theme="dark";}else{var stored=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});theme=stored==="light"||stored==="dark"?stored:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");}root.classList.toggle("dark",theme==="dark");root.dataset.theme="viresto";root.style.colorScheme=theme;}catch(error){}})();`;
