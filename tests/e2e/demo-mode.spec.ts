import { loadEnvFile } from "node:process";
import { test, expect, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { E2E_DEMO_EMAIL, resetE2eDemoOffice } from "../../prisma/e2e-demo-office";
import { syncSubscriptionFromPolar } from "@/lib/polar-subscription-sync";

/**
 * Demo mode ("try with sample data") in the browser, on an office that just
 * started its trial (reset before each test, also seeded by
 * `npm run seed:e2e`):
 *   enter demo → use a feature on the sample data → exit → the office
 *   subscribes → the sandbox and all its data are gone and the button with
 *   them; and a user still inside demo mode lands in the real office.
 *
 * "The office subscribes" runs the real syncSubscriptionFromPolar, the code
 * the Polar webhook runs after verifying the signature and re-fetching the
 * subscription from Polar (that transport is covered by
 * tests/integration/billing-*.test.ts and demo-mode.test.ts).
 *
 * Writes to the database the dev server uses: dev/test databases only, the
 * same guard as `npm run seed:e2e`.
 */

// DATABASE_URL lives in .env (playwright.config.ts loads only .env.local).
try {
  loadEnvFile(".env");
} catch {
  // CI sets the variables directly.
}

const PASSWORD = process.env.E2E_TEST_PASSWORD;
const UI_TIMEOUT_MS = 30_000;
const LOGIN_TIMEOUT_MS = 60_000;
const SHOTS = process.env.E2E_DEMO_SCREENSHOTS;

const prisma = new PrismaClient();
let tenantId = "";

function databaseHost() {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname.replace("-pooler.", ".");
  } catch {
    return "";
  }
}

const allowedHost = (process.env.E2E_ALLOWED_DATABASE_HOST ?? "").replace("-pooler.", ".");
const databaseAllowed = Boolean(allowedHost) && databaseHost() === allowedHost;

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
}

async function login(page: Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(E2E_DEMO_EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD!);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: LOGIN_TIMEOUT_MS });
}

async function enterDemo(page: Page) {
  const card = page.getByTestId("demo-mode-card");
  await expect(card).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await expect(card).toContainText("شوف كيف بيكون شكل مكتبك مع بيانات");
  await shot(page, "1-dashboard-card");

  await card.getByTestId("demo-enter").click();
  await expect(page.getByTestId("demo-loading")).toBeVisible();
  await shot(page, "2-loading");

  const banner = page.getByTestId("demo-mode-banner");
  await expect(banner).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await expect(banner).toContainText("أنت في وضع التجربة — البيانات وهمية");
  await shot(page, "3-demo-dashboard");
}

/** What the Polar webhook does for this office's first paid subscription. */
async function subscribeOffice() {
  const plan = await prisma.billingPlan.findUniqueOrThrow({
    where: { code: "PRO" },
    select: { polarMonthlyProductId: true },
  });
  const now = new Date();

  const result = await syncSubscriptionFromPolar({
    id: `sub_e2e_demo_${now.getTime()}`,
    productId: plan.polarMonthlyProductId!,
    status: "active",
    currency: "usd",
    amount: 5900,
    trialEnd: null,
    currentPeriodStart: now,
    currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: false,
    canceledAt: null,
    customerId: "cust_e2e_demo",
    metadata: { tenantId },
    customer: { externalId: tenantId },
  } as unknown as Parameters<typeof syncSubscriptionFromPolar>[0]);

  expect(result.ok, JSON.stringify(result)).toBe(true);
}

function sandboxCount() {
  return prisma.tenant.count({ where: { demoOwnerTenantId: tenantId, isDemo: true } });
}

test.describe("وضع التجربة ببيانات وهمية", () => {
  test.skip(!PASSWORD, "E2E_TEST_PASSWORD غير مضبوط");
  test.skip(
    !databaseAllowed,
    "قاعدة البيانات ليست E2E_ALLOWED_DATABASE_HOST: الاختبار يكتب في قاعدة البيانات",
  );

  // Login, building the sample office, and Next compiling each page the
  // first time in dev.
  test.setTimeout(240_000);

  test.beforeEach(async () => {
    ({ tenantId } = await resetE2eDemoOffice(prisma, await bcrypt.hash(PASSWORD!, 12)));
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("الدخول ← استخدام ميزة ← الخروج ← الاشتراك يحذف المكتب التجريبي ويخفي الزر", async ({ page }) => {
    await login(page);
    await enterDemo(page);

    // Billing is closed inside the sandbox, and says why.
    await page.goto("/dashboard/billing");
    await expect(page.getByText("هذا الإجراء غير متاح في وضع التجربة")).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Use a feature on the sample data: a new case for a sample client.
    await page.goto("/dashboard/cases");
    await expect(page.getByTestId("demo-mode-banner")).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await page.getByRole("button", { name: /قضية جديدة|New case/ }).first().click();

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await modal.getByTestId("case-client-search").fill("العبادي");
    // Each option reads "name / national ID - phone": the sample's fake ones.
    await modal.getByRole("button", { name: /محمد أحمد العبادي/ }).first().click({ timeout: UI_TIMEOUT_MS });

    const caseTitle = `قضية في وضع التجربة ${Date.now()}`;
    await modal.getByTestId("case-title").fill(caseTitle);
    await modal.locator("select").selectOption({ index: 1 });
    await modal.getByRole("button", { name: /حفظ|Save/ }).click();
    await expect(modal).not.toBeVisible({ timeout: UI_TIMEOUT_MS });

    const table = page.locator('[data-vds-view="desktop-table"]');
    await expect(table.getByText(caseTitle)).toBeVisible({ timeout: UI_TIMEOUT_MS });
    // Next to the sample cases (newest first, 10 a page).
    await expect(table.getByText("إصابة عمل").first()).toBeVisible();
    await shot(page, "4-demo-cases");

    // Exit: back in the real office, which has none of it.
    await page.getByTestId("demo-exit").click();
    await page.waitForURL(/\/dashboard$/, { timeout: UI_TIMEOUT_MS });
    await expect(page.getByTestId("demo-mode-banner")).toHaveCount(0);
    await expect(page.getByTestId("demo-mode-card")).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await shot(page, "5-back-in-real-office");

    await page.goto("/dashboard/cases");
    await expect(page.getByText(caseTitle)).toHaveCount(0);
    expect(await prisma.case.count({ where: { tenantId } })).toBe(0);
    expect(await sandboxCount()).toBe(1);

    // The office subscribes: the sandbox and all its data are deleted.
    await subscribeOffice();
    expect(await sandboxCount()).toBe(0);
    expect(await prisma.case.count({ where: { title: caseTitle } })).toBe(0);

    // And the button is gone for good (allow the server's 5 s access cache).
    await expect(async () => {
      await page.goto("/dashboard");
      await expect(page.getByRole("heading").first()).toBeVisible({ timeout: UI_TIMEOUT_MS });
      await expect(page.getByTestId("demo-mode-card")).toHaveCount(0);
    }).toPass({ timeout: 30_000 });
    await shot(page, "6-subscribed-no-card");

    const enter = await page.request.post("/api/demo/enter", {
      headers: { origin: new URL(page.url()).origin },
    });
    expect(enter.status()).toBe(403);
  });

  test("مستخدم داخل وضع التجربة عند الاشتراك يرجع لمكتبه الحقيقي بالطلب التالي", async ({ page }) => {
    await login(page);
    await enterDemo(page);

    await subscribeOffice();
    expect(await sandboxCount()).toBe(0);

    // The page's next request answers DEMO_ENDED and switches the cookie
    // back; the client follows it to the real office's dashboard.
    await page.goto("/dashboard/clients");
    await page.waitForURL(/\/dashboard$/, { timeout: UI_TIMEOUT_MS });
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await expect(page.getByTestId("demo-mode-banner")).toHaveCount(0);
    await expect(page.getByTestId("demo-mode-card")).toHaveCount(0);
    await shot(page, "7-ended-while-inside");

    await page.goto("/dashboard/clients");
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await expect(page.getByText("محمد أحمد العبادي")).toHaveCount(0);

    const state = await page.request.get("/api/demo");
    expect(state.status()).toBe(200);
    expect((await state.json()).data.inDemo).toBe(false);
  });
});
