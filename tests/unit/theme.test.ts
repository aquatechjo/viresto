import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {
  FORCED_DARK_PATHS,
  THEME_INIT_SCRIPT,
  isForcedDarkPath,
  resolveTheme,
} from "../../src/lib/theme";

// The landing page is always dark; every other page follows the user's
// stored theme, else the OS. The inline pre-paint script must make the same
// decision as resolveTheme, and must not touch localStorage on a
// forced-dark page.

function runInitScript(pathname: string, stored: string | null, osPrefersDark: boolean) {
  const classes = new Set<string>();
  const storageReads: string[] = [];
  const storageWrites: string[] = [];
  let mediaQueried = false;
  const root = {
    classList: {
      toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)),
    },
    dataset: {} as Record<string, string>,
    style: { colorScheme: "" },
  };

  vm.runInNewContext(THEME_INIT_SCRIPT, {
    document: { documentElement: root },
    location: { pathname },
    localStorage: {
      getItem: (key: string) => {
        storageReads.push(key);
        return stored;
      },
      setItem: (key: string) => storageWrites.push(key),
    },
    window: {
      matchMedia: () => {
        mediaQueried = true;
        return { matches: osPrefersDark };
      },
    },
  });

  return {
    theme: classes.has("dark") ? "dark" : "light",
    colorScheme: root.style.colorScheme,
    storageReads,
    storageWrites,
    mediaQueried,
  };
}

test("the landing page is dark whatever the stored theme and OS preference", () => {
  assert.deepEqual(FORCED_DARK_PATHS, ["/"]);

  for (const stored of ["light", "dark", null, "garbage"]) {
    for (const osPrefersDark of [true, false]) {
      assert.equal(resolveTheme("/", stored, osPrefersDark), "dark");

      const run = runInitScript("/", stored, osPrefersDark);
      assert.equal(run.theme, "dark", `stored=${stored} os=${osPrefersDark}`);
      assert.equal(run.colorScheme, "dark");
      assert.deepEqual(run.storageReads, [], "landing must not read the stored theme");
      assert.deepEqual(run.storageWrites, [], "landing must not write the stored theme");
      assert.equal(run.mediaQueried, false);
    }
  }
});

test("every other page follows the stored theme, else the OS, in the script and on the client", () => {
  const cases: Array<[string | null, boolean, "light" | "dark"]> = [
    ["light", true, "light"],
    ["dark", false, "dark"],
    [null, true, "dark"],
    [null, false, "light"],
    ["garbage", false, "light"],
  ];

  for (const pathname of ["/dashboard", "/login", "/pricing", "/dashboard/settings"]) {
    assert.equal(isForcedDarkPath(pathname), false, pathname);
    for (const [stored, osPrefersDark, expected] of cases) {
      assert.equal(resolveTheme(pathname, stored, osPrefersDark), expected);
      const run = runInitScript(pathname, stored, osPrefersDark);
      assert.equal(run.theme, expected, `${pathname} stored=${stored} os=${osPrefersDark}`);
      assert.equal(run.colorScheme, expected);
      assert.deepEqual(run.storageWrites, [], "the pre-paint script never writes");
    }
  }
});

test("only the exact landing path is forced", () => {
  for (const pathname of ["/x", "/dashboard", "//", "/index"]) {
    assert.equal(isForcedDarkPath(pathname), false, pathname);
  }
});
