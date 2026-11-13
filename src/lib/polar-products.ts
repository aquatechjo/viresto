// Which Polar products belong to each BillingPlan.
//
// Production: the BillingPlan columns (polarMonthlyProductId /
// polarYearlyProductId), exactly as stored. Nothing here changes them.
//
// Sandbox only: POLAR_PRODUCT_IDS, a JSON map such as
//   {"BASIC":{"monthly":"<id>","yearly":"<id>"},"PRO":{...},"BUSINESS":{...}}
// replaces the columns completely (a cycle left out is "not set up"), so a
// dev database seeded with production ids can be tested against the Polar
// sandbox without rewriting its rows. It is ignored whenever
// POLAR_ENVIRONMENT is "production", and scripts/check-env.mjs refuses a
// production build that sets it.

export type PlanProductColumns = {
  code: string;
  polarMonthlyProductId: string | null;
  polarYearlyProductId: string | null;
};

type Override = Record<string, { monthly?: string; yearly?: string }>;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

let parsed: { raw: string | undefined; value: Override | null } | null = null;

/** The sandbox override, or null (production, unset, or invalid). */
export function sandboxProductOverride(
  env: Record<string, string | undefined> = process.env,
): Override | null {
  if (env.POLAR_ENVIRONMENT === "production") return null;

  const raw = env.POLAR_PRODUCT_IDS?.trim();
  if (!raw) return null;
  if (parsed && parsed.raw === raw) return parsed.value;

  let value: Override | null = null;
  try {
    const json = JSON.parse(raw) as unknown;
    if (json && typeof json === "object" && !Array.isArray(json)) {
      value = {};
      for (const [code, cycles] of Object.entries(json as Record<string, unknown>)) {
        const entry = (cycles ?? {}) as Record<string, unknown>;
        const monthly = typeof entry.monthly === "string" && ID_PATTERN.test(entry.monthly) ? entry.monthly : undefined;
        const yearly = typeof entry.yearly === "string" && ID_PATTERN.test(entry.yearly) ? entry.yearly : undefined;
        value[code.toUpperCase()] = { monthly, yearly };
      }
    }
  } catch {
    value = null;
  }
  if (!value) console.error("[polar-products] POLAR_PRODUCT_IDS is not a valid JSON map; ignored");

  parsed = { raw, value };
  return value;
}

/** The plan with the product ids to use (sandbox override, else as stored). */
export function withPolarProductIds<T extends PlanProductColumns>(
  plan: T,
  env: Record<string, string | undefined> = process.env,
): T {
  const override = sandboxProductOverride(env);
  if (!override) return plan;

  const ids = override[String(plan.code ?? "").toUpperCase()];
  return {
    ...plan,
    polarMonthlyProductId: ids?.monthly ?? null,
    polarYearlyProductId: ids?.yearly ?? null,
  };
}

/** The plan code a product id belongs to under the sandbox override. */
export function sandboxPlanCodeForProduct(
  productId: string,
  env: Record<string, string | undefined> = process.env,
): string | null | undefined {
  const override = sandboxProductOverride(env);
  if (!override) return undefined; // no override: use the columns
  for (const [code, ids] of Object.entries(override)) {
    if (ids.monthly === productId || ids.yearly === productId) return code;
  }
  return null;
}
