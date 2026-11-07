import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";

// The custom properties <html> ends up with in each theme, read from
// globals.css by the cascade: the theme class sits on <html> (theme.ts),
// so only rules for :root, html and .dark apply to it. Values are resolved
// through var() so a moved or renamed indirection compares equal.

export type ThemeMode = "light" | "dark";
export type ThemeVars = Record<string, string>;

const SELECTORS: Record<ThemeMode, Record<string, number>> = {
  // selector -> specificity (classes and pseudo-classes x10, elements x1)
  light: { html: 1, ":root": 10, ":root:not(.dark)": 20 },
  dark: { html: 1, ":root": 10, ".dark": 10, "html.dark": 11 },
};

export const GLOBALS_CSS = path.join(process.cwd(), "src/app/globals.css");

export function rawThemeVars(css: string, mode: ThemeMode): ThemeVars {
  const winner = new Map<string, { value: string; specificity: number }>();
  postcss.parse(css).walkRules((rule) => {
    // Rules inside @media / @supports would only apply conditionally.
    if (rule.parent?.type !== "root") return;
    const specificities = rule.selectors
      .map((selector) => SELECTORS[mode][selector.trim()])
      .filter((value): value is number => value !== undefined);
    if (specificities.length === 0) return;
    const specificity = Math.max(...specificities);
    rule.walkDecls((decl) => {
      if (!decl.prop.startsWith("--")) return;
      const current = winner.get(decl.prop);
      // Later rules win ties, as in the browser.
      if (!current || specificity >= current.specificity) {
        winner.set(decl.prop, { value: decl.value.trim(), specificity });
      }
    });
  });
  return Object.fromEntries([...winner].map(([prop, { value }]) => [prop, value]));
}

function resolve(value: string, vars: ThemeVars, depth = 0): string {
  if (depth > 20) throw new Error(`var() cycle in ${value}`);
  return value.replace(/var\((--[a-z0-9-]+)(?:\s*,\s*([^)]*))?\)/gi, (_m, name: string, fallback?: string) => {
    const next = vars[name] ?? fallback;
    if (next === undefined) return `var(${name})`;
    return resolve(next, vars, depth + 1);
  });
}

/** Effective, var()-resolved values of every custom property on <html>. */
export function themeVars(mode: ThemeMode, css = fs.readFileSync(GLOBALS_CSS, "utf8")): ThemeVars {
  const raw = rawThemeVars(css, mode);
  return Object.fromEntries(
    Object.keys(raw).sort().map((name) => [name, resolve(raw[name], raw).replace(/\s+/g, " ")]),
  );
}
