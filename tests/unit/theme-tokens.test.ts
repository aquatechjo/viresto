import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { themeVars } from "./helpers/theme-vars";
import { brandDark, themeTokens, type ThemeMode } from "@/lib/theme/tokens";

// Color plan, batch 1 (2026-11-07): the palette moved into
// src/lib/theme/tokens.ts and the two .dark blocks of globals.css were
// merged. Neither may change anything on screen.

const before = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests/unit/fixtures/theme-vars.before-merge.json"), "utf8"),
) as Record<ThemeMode, Record<string, string>>;

for (const mode of ["light", "dark"] as const) {
  test(`${mode}: every custom property on <html> has its value from before the merge`, () => {
    assert.deepEqual(themeVars(mode), before[mode]);
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
