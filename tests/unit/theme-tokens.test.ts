import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { themeVars } from "./helpers/theme-vars";
import { brandDark, themeTokens, type ThemeMode } from "@/lib/theme/tokens";
import { STATUS_TONES, statusBadgeClass, statusTone } from "@/lib/theme/status";

// Color plan (approved 2026-11-07). Batch 1 moved the palette into
// tokens.ts and merged the two .dark blocks of globals.css without any
// visual change; later batches change only what the user approved.

const before = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests/unit/fixtures/theme-vars.before-merge.json"), "utf8"),
) as Record<ThemeMode, Record<string, string>>;

/** Values changed on purpose since batch 1, each approved by the user. */
const APPROVED_CHANGES: Record<ThemeMode, Record<string, string>> = {
  // Batch 2: AA contrast for muted text in the light theme.
  light: { "--text-3": "#5f7470", "--muted": "#5f7470" },
  dark: {},
};

for (const mode of ["light", "dark"] as const) {
  test(`${mode}: every custom property from before the color plan keeps its value, unless approved`, () => {
    const vars = themeVars(mode);
    for (const [name, value] of Object.entries(before[mode])) {
      assert.equal(vars[name], APPROVED_CHANGES[mode][name] ?? value, `${mode} ${name}`);
    }
  });

  test(`${mode}: tokens.ts equals what globals.css gives the app`, () => {
    const vars = themeVars(mode);
    for (const [name, value] of Object.entries(themeTokens[mode])) {
      assert.equal(vars[`--${name}`], value.replace(/\s+/g, " "), `${mode} --${name}`);
    }
    for (const [name, value] of Object.entries(brandDark)) {
      assert.equal(vars[`--${name}`], value, `${mode} --${name}`);
    }
  });
}

test("globals.css has one .dark block", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
  assert.equal(css.match(/^\.dark\s*\{/gm)?.length, 1);
});

// WCAG 2 contrast of two opaque hex colors.
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const [r, g, bl] = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

test("AA: every tone's text on its own background, in both themes", () => {
  for (const mode of ["light", "dark"] as const) {
    const t = themeTokens[mode];
    for (const tone of ["green", "amber", "red", "blue", "purple", "gray"] as const) {
      const fg = t[`tone-${tone}-fg`];
      const bg = t[`tone-${tone}-bg`];
      assert.ok(contrast(fg, bg) >= 4.5, `${mode} ${tone}: ${fg} on ${bg} = ${contrast(fg, bg).toFixed(2)}`);
      // On a plain card too (chips placed without their soft background).
      assert.ok(contrast(fg, t.card) >= 4.5, `${mode} ${tone} on card`);
    }
  }
});

test("AA: light muted text and the primary button text", () => {
  const l = themeTokens.light;
  for (const bg of [l.bg, l.card, l["card-2"]]) {
    assert.ok(contrast(l["text-3"], bg) >= 4.5, `text-3 on ${bg}`);
    assert.ok(contrast(l.muted, bg) >= 4.5, `muted on ${bg}`);
  }
  for (const mode of ["light", "dark"] as const) {
    const t = themeTokens[mode];
    assert.ok(contrast(t["on-gold"], t.gold) >= 4.5, `${mode} on-gold on gold`);
  }
});

test("status tones: the approved map", () => {
  assert.deepEqual(STATUS_TONES.priority, { URGENT: "red", HIGH: "amber", MEDIUM: "blue", LOW: "gray" });
  assert.equal(statusTone("task", "CANCELLED"), "gray");
  assert.equal(statusTone("case", "CLOSED"), "gray");
  assert.equal(statusTone("case", "IN_PROGRESS"), "blue");
  assert.equal(statusTone("task", "IN_PROGRESS"), "blue");
  assert.equal(statusTone("invoice", "OVERDUE"), "red");
  assert.equal(statusTone("payment", "PENDING"), "amber");
  assert.equal(statusTone("invoice", "UNKNOWN"), "gray");
  assert.equal(statusBadgeClass("invoice", "PAID"), "badge badge-green");
});

test("status badge classes in globals.css use the tone of status.ts", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
  for (const tones of Object.values(STATUS_TONES)) {
    for (const [status, tone] of Object.entries(tones)) {
      // The rule that lists .badge-<STATUS> must use --tone-<tone>-fg.
      const rule = css.match(new RegExp(`\\.badge-${status}\\b[^{]*\\{[^}]*\\}`))?.[0] ?? "";
      assert.match(rule, new RegExp(`--tone-${tone}-fg`), `.badge-${status} -> ${tone}`);
    }
  }
});
