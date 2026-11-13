import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Page entrance motion budget: from render to the last block fully visible
// (stagger delay + fade duration) is at most 0.15s.

const BUDGET_S = 0.15;
const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

function seconds(value: string) {
  const match = value.trim().match(/^([\d.]+)(ms|s)$/);
  assert.ok(match, `not a time: ${value}`);
  return match[2] === "ms" ? Number(match[1]) / 1000 : Number(match[1]);
}

function rules(selectorPattern: RegExp) {
  const found: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const selector = m[1].trim();
    if (selectorPattern.test(selector)) found.push({ selector, body: m[2] });
  }
  return found;
}

function animationDuration(body: string) {
  const shorthand = body.match(/animation:\s*[\w-]+\s+([\d.]+m?s)/);
  return shorthand ? seconds(shorthand[1]) : null;
}

test("stagger: largest delay + fade duration is within 0.15s", () => {
  const base = rules(/^\.stagger > \*$/);
  assert.equal(base.length, 1);
  const duration = animationDuration(base[0].body);
  assert.ok(duration !== null);

  const delays = rules(/^\.stagger > \*:nth-child/).map(({ body }) => {
    const delay = body.match(/animation-delay:\s*([\d.]+m?s)/);
    assert.ok(delay);
    return seconds(delay[1]);
  });
  assert.ok(delays.length > 0);

  const total = Math.max(0, ...delays) + duration;
  assert.ok(total <= BUDGET_S + 1e-9, `stagger total ${total}s`);
});

test("stagger: every child past the listed ones is covered (no child without a delay rule after a delayed one)", () => {
  // The last rule must be an open-ended nth-child(n + k), so the 9th, 10th...
  // block does not fall back to no delay and appear before the earlier ones.
  const selectors = rules(/^\.stagger > \*:nth-child/).map((r) => r.selector);
  assert.match(selectors[selectors.length - 1], /nth-child\(n \+ \d+\)/);
});

test("entrance utilities (.animate-fade/-slide/-scale) are within 0.15s", () => {
  for (const name of ["animate-fade", "animate-slide", "animate-scale"]) {
    const found = rules(new RegExp(`^\\.${name}$`));
    assert.equal(found.length, 1, name);
    const duration = animationDuration(found[0].body);
    assert.ok(duration !== null && duration <= BUDGET_S, `${name}: ${duration}s`);
  }
});

// The one scoped exception (user decision, 2026-11-13): the subscriptions
// page has its own, longer entrance in src/components/billing/billing-motion.ts.
// Nothing outside that page may use it.
test("billing-motion (0.45s entrances) is used only by the subscriptions page", async () => {
  const { readdirSync, statSync } = await import("node:fs");
  const allowed = [
    path.join("src", "components", "billing"),
    path.join("src", "app", "dashboard", "billing"),
  ];
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (/\.(ts|tsx)$/.test(name)) {
        const text = readFileSync(full, "utf8");
        if (/billing-motion/.test(text) && !allowed.some((dir) => full.startsWith(dir))) {
          offenders.push(full);
        }
      }
    }
  };
  walk("src");
  assert.deepEqual(offenders, []);
});

test("billing-motion: entrance 0.45s, 80ms apart, 16px rise; toggle spring without overshoot", async () => {
  const motion = await import("../../src/components/billing/billing-motion");
  assert.deepEqual(motion.BILLING_ENTRANCE, { duration: 0.45, rise: 16, stagger: 0.08 });
  assert.equal(motion.TOGGLE_SPRING.bounce, 0);
  assert.deepEqual(motion.entrance(2, true), { initial: false });
  assert.deepEqual(motion.revealOnScroll(true), { initial: false });
  assert.equal((motion.entrance(2, false) as { transition: { delay: number } }).transition.delay, 0.16);
});

test("billing-motion: prices split around the number and count back in Latin digits", async () => {
  const { splitPrice, formatCount } = await import("../../src/components/billing/billing-motion");
  assert.deepEqual(splitPrice("⁦$1,190⁩"), { before: "⁦$", value: 1190, after: "⁩", decimals: 0 });
  assert.deepEqual(splitPrice("29.50 JOD"), { before: "", value: 29.5, after: " JOD", decimals: 2 });
  assert.equal(splitPrice("free"), null);
  assert.equal(formatCount(1190, 0), "1,190");
});
