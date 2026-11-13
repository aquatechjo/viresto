// The checks behind scripts/update-polar-yearly-products.ts: which
// BillingPlan row gets which new Polar yearly product, and every reason
// not to write at all. Pure (no database, no Polar), so it is unit-tested.

import { polarProductProblems, type PolarProductLike } from "@/lib/polar-product-check";

export type PlanRow = {
  code: string;
  name: string;
  priceYearly: number;
  polarMonthlyProductId: string | null;
  polarYearlyProductId: string | null;
};

/** A Polar-linked subscription row that could still be on an old yearly product. */
export type YearlySubscriptionRow = {
  id: string;
  tenantId: string;
  status: string;
  currentPeriodEnd: Date | null;
};

export type YearlyAssignment = {
  code: string;
  productId: string;
  productName: string;
  before: string | null;
};

export type YearlyUpdatePlan =
  | { ok: true; assignments: YearlyAssignment[] }
  | { ok: false; problems: string[] };

const LIVE_STATUSES = new Set(["ACTIVE", "TRIALING", "PAST_DUE"]);

/** True when `name` names this plan ("Viresto - Pro Yearly" -> Pro), as a whole word. */
function namesPlan(name: string, planName: string) {
  return new RegExp(`(^|[^a-z])${planName.toLowerCase()}([^a-z]|$)`).test(name.toLowerCase());
}

function namesYearly(name: string) {
  return /(^|[^a-z])(yearly|annual|year)([^a-z]|$)/.test(name.toLowerCase());
}

/**
 * Matches each product to exactly one plan by BOTH its name (the plan's
 * name, and "Yearly") and its price (the plan's yearly price), never by
 * the order given. Any doubt is a problem, and any problem means no write.
 */
export function planYearlyProductUpdate(input: {
  products: PolarProductLike[];
  plans: PlanRow[];
  /** Polar-linked subscriptions with interval YEARLY. */
  yearlySubscriptions: YearlySubscriptionRow[];
  now?: Date;
}): YearlyUpdatePlan {
  const now = input.now ?? new Date();
  const problems: string[] = [];

  // Replacing a yearly id makes the webhook ignore a subscription still on
  // the old product (findBillingPlanForPolarProduct): its renewals, plan
  // changes and cancellation would never reach the office.
  for (const sub of input.yearlySubscriptions) {
    const stillRunning =
      LIVE_STATUSES.has(sub.status) ||
      (sub.currentPeriodEnd !== null && sub.currentPeriodEnd.getTime() > now.getTime());
    if (stillRunning) {
      problems.push(
        `subscription ${sub.id} (tenant ${sub.tenantId}, ${sub.status}) is YEARLY and still running: it may be on an old yearly product`,
      );
    }
  }

  if (input.products.length !== input.plans.length) {
    problems.push(`${input.products.length} products for ${input.plans.length} plans`);
  }

  const assignments: YearlyAssignment[] = [];
  const usedPlans = new Set<string>();

  for (const product of input.products) {
    const name = product.name ?? "";
    const byName = input.plans.filter((plan) => namesPlan(name, plan.name));
    const price = (product.prices ?? []).find((p) => !p.isArchived)?.priceAmount;
    const byPrice = input.plans.filter((plan) => plan.priceYearly === price);

    if (!namesYearly(name)) problems.push(`${product.id}: name "${name}" does not say yearly`);
    if (byName.length !== 1) {
      problems.push(`${product.id}: name "${name}" matches ${byName.length} plans`);
      continue;
    }
    const [plan] = byName;
    if (byPrice.length !== 1 || byPrice[0].code !== plan.code) {
      problems.push(
        `${product.id}: name says ${plan.code} but the price (${price ?? "none"} cents) says ${byPrice.map((p) => p.code).join("/") || "no plan"}`,
      );
      continue;
    }
    if (usedPlans.has(plan.code)) {
      problems.push(`${product.id}: a second product for ${plan.code}`);
      continue;
    }

    const productProblems = polarProductProblems(product, {
      cycle: "yearly",
      amountCents: plan.priceYearly,
      requireNoTrial: true,
    });
    for (const problem of productProblems) problems.push(`${product.id} (${plan.code}): ${problem}`);

    if (product.id === plan.polarMonthlyProductId) {
      problems.push(`${product.id} is ${plan.code}'s monthly product`);
    }

    usedPlans.add(plan.code);
    assignments.push({
      code: plan.code,
      productId: product.id,
      productName: name,
      before: plan.polarYearlyProductId,
    });
  }

  for (const plan of input.plans) {
    if (!usedPlans.has(plan.code)) problems.push(`no product for ${plan.code}`);
  }

  return problems.length ? { ok: false, problems } : { ok: true, assignments };
}
