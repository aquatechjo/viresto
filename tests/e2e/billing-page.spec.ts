import { test, expect, type Page, type Route } from "@playwright/test";
import { AUTH_FILE } from "./global-setup";

/**
 * The subscriptions page (/dashboard/billing) in its three main states:
 * trial, active, expired. /api/billing and /api/billing/access are
 * answered from the real response of the E2E office, adjusted per state,
 * so nothing is written; everything else (layout, theme, components) is
 * the real app. Checked in light and dark, at 390px and 1440px, with no
 * horizontal scroll.
 */

test.use({ storageState: AUTH_FILE, locale: "ar-JO" });

const UI_TIMEOUT_MS = 30_000;
const DAY = 86_400_000;

type BillingBody = { success: boolean; data: Record<string, any> };

async function realBilling(page: Page): Promise<BillingBody> {
  const res = await page.request.get("/api/billing");
  expect(res.status(), "the E2E user must be the office admin").toBe(200);
  return (await res.json()) as BillingBody;
}

function asState(real: BillingBody, state: "trial" | "active" | "expired"): BillingBody {
  const body = JSON.parse(JSON.stringify(real)) as BillingBody;
  const d = body.data;
  if (state === "trial") {
    const trialEndsAt = new Date(Date.now() + 9 * DAY + 3_600_000).toISOString();
    d.access = { ...d.access, state: "TRIAL", trialEndsAt, trialDaysLeft: 10, paymentFailed: false };
    d.tenant.trialEndsAt = trialEndsAt;
    d.subscription = null;
  } else if (state === "expired") {
    d.access = { ...d.access, state: "LOCKED", lockReason: "TRIAL_EXPIRED", paymentFailed: false };
    d.subscription = null;
  } else {
    d.access = { ...d.access, state: "PAID", paymentFailed: false };
    d.subscription = {
      ...(d.subscription ?? {}),
      status: "ACTIVE",
      interval: "MONTHLY",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date(Date.now() + 20 * DAY).toISOString(),
      plan: d.availablePlans.find((p: { code: string }) => p.code === "PRO"),
      amount: d.subscription?.amount ?? { raw: 0, value: 0, currency: "USD", formatted: "$59" },
    };
  }
  return body;
}

async function openAs(page: Page, body: BillingBody, theme: "light" | "dark") {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem("theme", t);
    } catch {
      // ignore
    }
  }, theme);
  await page.route("**/api/billing", (route: Route) => route.fulfill({ json: body }));
  await page.route("**/api/billing/access*", (route: Route) =>
    route.fulfill({
      json: { success: true, data: { access: body.data.access, canWrite: body.data.access.state !== "LOCKED" } },
    }),
  );
  await page.goto("/dashboard/billing");
  await expect(page.getByTestId("plan-cards")).toBeVisible({ timeout: UI_TIMEOUT_MS });
}

async function expectCommonSections(page: Page) {
  for (const code of ["BASIC", "PRO", "BUSINESS"]) {
    await expect(page.getByTestId(`plan-card-${code}`)).toBeVisible();
  }
  // Pro is the recommended plan, badge included.
  await expect(page.getByTestId("plan-card-PRO")).toHaveAttribute("data-recommended", "true");
  await expect(page.getByTestId("plan-card-PRO").getByText("الأكثر طلباً")).toBeVisible();
  // Prices in Latin digits.
  await expect(page.getByTestId("plan-card-PRO")).toContainText("$59");
  await expect(page.getByTestId("trust-row")).toBeVisible();
  await page.getByTestId("comparison-table").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("comparison-table")).toBeVisible();
  await expect(page.getByTestId("billing-faq")).toBeVisible();
  // The monthly/yearly switch shows only when every plan has a yearly product.
  const real = await page.request.get("/api/billing").then((r) => r.json());
  const yearly = real.data.availablePlans.every((p: { purchasable?: { yearly: boolean } }) => p.purchasable?.yearly);
  await expect(page.getByTestId("cycle-toggle")).toHaveCount(yearly ? 1 : 0);
  // No horizontal page scroll.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

for (const theme of ["light", "dark"] as const) {
  for (const [device, viewport] of [
    ["mobile", { width: 390, height: 844 }],
    ["desktop", { width: 1440, height: 900 }],
  ] as const) {
    test.describe(`${theme} ${device}`, () => {
      test.use({ viewport });

      test("trial: banner with days left and progress, plans to choose from", async ({ page }) => {
        const body = asState(await realBilling(page), "trial");
        await openAs(page, body, theme);
        await expect(page.getByTestId("trial-banner")).toBeVisible();
        await expect(page.getByTestId("trial-banner")).toContainText("10 أيام متبقية");
        await expect(page.getByTestId("trial-banner").getByRole("progressbar")).toBeVisible();
        await expect(page.getByTestId("active-subscription")).toHaveCount(0);
        await expect(page.getByTestId("subscribe-PRO")).toHaveText("اشترك الآن");
        await expectCommonSections(page);
      });

      test("active: current plan, renewal date, manage button; the current plan cannot be re-bought", async ({ page }) => {
        const body = asState(await realBilling(page), "active");
        await openAs(page, body, theme);
        const card = page.getByTestId("active-subscription");
        await expect(card).toBeVisible();
        await expect(card).toContainText("Viresto Pro");
        await expect(card).toContainText("$59");
        await expect(card).toContainText("يتجدد في");
        await expect(page.getByTestId("manage-subscription")).toHaveText("إدارة الاشتراك");
        await expect(page.getByTestId("subscribe-PRO")).toBeDisabled();
        await expect(page.getByTestId("trial-banner")).toHaveCount(0);
        await expectCommonSections(page);
      });

      test("expired: clear message and a direct path to renew", async ({ page }) => {
        const body = asState(await realBilling(page), "expired");
        await openAs(page, body, theme);
        const notice = page.getByTestId("expired-notice");
        await expect(notice).toBeVisible();
        await expect(notice).toContainText("انتهى اشتراكك");
        await notice.getByRole("button", { name: "جدّد اشتراكك" }).click();
        await expect(page.getByTestId("plan-cards")).toBeInViewport();
        await expectCommonSections(page);
      });
    });
  }
}
