// Is a plan's Polar product what we promise (interval, price, one active
// fixed USD price, not archived)? Used two ways:
//   - the checkout, before anyone is charged: always a fresh read
//     (checkPlanProduct);
//   - the subscriptions page, to offer a cycle only when its product would
//     pass that same check (isCycleOfferable): cached briefly, so the page
//     does not call Polar on every load.

import { planPriceCents } from "@/config/plans";
import { getPolarClient } from "@/lib/polar";
import {
  polarProductProblems,
  type BillingCycle,
  type ProductExpectation,
} from "@/lib/polar-product-check";

export type PlanProductCheck =
  | { ok: true }
  | { ok: false; reason: "mismatch" | "unavailable"; problems: string[] };

type ProductReader = { products: { get(args: { id: string }): Promise<unknown> } };

/** Reads the product from Polar and checks it. Polar unreachable = not ok. */
export async function checkPlanProduct(
  polar: ProductReader,
  productId: string,
  expected: ProductExpectation,
): Promise<PlanProductCheck> {
  let product;
  try {
    product = await polar.products.get({ id: productId });
  } catch {
    return { ok: false, reason: "unavailable", problems: [] };
  }

  const problems = polarProductProblems(
    product as Parameters<typeof polarProductProblems>[0],
    expected,
  );
  return problems.length ? { ok: false, reason: "mismatch", problems } : { ok: true };
}

/** A passing product is trusted for 5 minutes, a failing one for 1. */
export const OFFERABLE_OK_TTL_MS = 5 * 60_000;
export const OFFERABLE_FAIL_TTL_MS = 60_000;

const cache = new Map<string, { ok: boolean; until: number }>();
const inFlight = new Map<string, Promise<boolean>>();

/**
 * Whether the page may offer this plan and cycle: its product passes the
 * checkout's product check. Cached per product, cycle and price (in this
 * server instance). Fails closed: Polar unreachable hides the cycle.
 */
export async function isCycleOfferable(
  planCode: string,
  cycle: BillingCycle,
  productId: string | null | undefined,
  options: { polar?: ProductReader; now?: () => number } = {},
): Promise<boolean> {
  if (!productId) return false;
  const amountCents = planPriceCents(planCode, cycle);
  if (amountCents === null) return false;

  const now = options.now ?? Date.now;
  const key = `${productId}|${cycle}|${amountCents}`;
  const cached = cache.get(key);
  if (cached && cached.until > now()) return cached.ok;

  const running = inFlight.get(key);
  if (running) return running;

  const check = (async () => {
    let polar: ProductReader;
    try {
      polar = options.polar ?? getPolarClient();
    } catch {
      return false;
    }
    const result = await checkPlanProduct(polar, productId, {
      cycle,
      amountCents,
      // The checkout sends allowTrial: false, which disables a product trial.
      requireNoTrial: false,
    });
    cache.set(key, {
      ok: result.ok,
      until: now() + (result.ok ? OFFERABLE_OK_TTL_MS : OFFERABLE_FAIL_TTL_MS),
    });
    if (!result.ok) {
      console.warn(
        `[billing-offer] ${cycle} hidden plan=${planCode} product=${productId} reason=${result.reason}${result.problems.length ? ` problems=${JSON.stringify(result.problems)}` : ""}`,
      );
    }
    return result.ok;
  })().finally(() => inFlight.delete(key));

  inFlight.set(key, check);
  return check;
}

/** Tests only. */
export function clearOfferableCache() {
  cache.clear();
  inFlight.clear();
}
