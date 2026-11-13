// Verifies that a Polar product is what a plan and billing cycle promise:
// recurring every month or every year (interval count 1), one active fixed
// price in USD equal to the plan's price, not archived, and (when asked)
// no trial. Used by
// the checkout route before every checkout or plan change, and by
// scripts/update-polar-yearly-products.ts before writing product ids.
//
// Why: on 2026-11-13 the sandbox's three "Yearly" products turned out to
// recur every *month* at the yearly price; a checkout on them would have
// charged 290/590/1190 USD every month.

export type BillingCycle = "monthly" | "yearly";

/** The fields of a Polar product this check reads (SDK Product shape). */
export type PolarProductLike = {
  id: string;
  name?: string | null;
  isArchived?: boolean | null;
  isRecurring?: boolean | null;
  recurringInterval?: string | null;
  recurringIntervalCount?: number | null;
  trialInterval?: string | null;
  trialIntervalCount?: number | null;
  prices?: ReadonlyArray<{
    amountType?: string | null;
    priceAmount?: number | null;
    priceCurrency?: string | null;
    isArchived?: boolean | null;
  }> | null;
};

export type ProductExpectation = {
  cycle: BillingCycle;
  /** USD cents, as BillingPlan.priceMonthly / priceYearly. */
  amountCents: number;
  /**
   * Whether a trial on the product is a problem. The checkout sends
   * allowTrial: false, which disables a product trial, so it does not
   * block on one; writing product ids into BillingPlan does.
   */
  requireNoTrial: boolean;
};

const INTERVAL_BY_CYCLE: Record<BillingCycle, string> = {
  monthly: "month",
  yearly: "year",
};

/** Every way `product` differs from `expected`; empty when it matches. */
export function polarProductProblems(
  product: PolarProductLike,
  expected: ProductExpectation,
): string[] {
  const problems: string[] = [];
  const interval = INTERVAL_BY_CYCLE[expected.cycle];

  if (product.isArchived) problems.push("archived");
  if (product.isRecurring === false) problems.push("not recurring");
  if (product.recurringInterval !== interval) {
    problems.push(`interval is "${product.recurringInterval ?? "none"}", expected "${interval}"`);
  }
  if ((product.recurringIntervalCount ?? 1) !== 1) {
    problems.push(`interval count is ${product.recurringIntervalCount}, expected 1`);
  }
  if (expected.requireNoTrial && (product.trialInterval || (product.trialIntervalCount ?? 0) > 0)) {
    problems.push(`has a trial (${product.trialIntervalCount ?? ""} ${product.trialInterval ?? ""})`.trim());
  }

  const prices = (product.prices ?? []).filter((price) => !price.isArchived);
  if (prices.length !== 1) {
    problems.push(`${prices.length} active prices, expected 1`);
  } else {
    const [price] = prices;
    if (price.amountType !== "fixed") problems.push(`price type is "${price.amountType}", expected "fixed"`);
    if ((price.priceCurrency ?? "").toLowerCase() !== "usd") {
      problems.push(`currency is "${price.priceCurrency}", expected "usd"`);
    }
    if (price.priceAmount !== expected.amountCents) {
      problems.push(`price is ${price.priceAmount} cents, expected ${expected.amountCents}`);
    }
  }

  return problems;
}
