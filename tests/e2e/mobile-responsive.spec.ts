import { test, expect, type Page } from "@playwright/test";
import { AUTH_FILE } from "./global-setup";

/**
 * اختبار عدم وجود تمرير أفقي (horizontal overflow) في الصفحات التي
 * أُصلحت لعرض الموبايل: التنبيهات، التقويم، الجداول، والمساعد الذكي،
 * وسجل النشاط.
 *
 * محجوب بنفس شرط login.spec.ts: لازم E2E_TEST_EMAIL/PASSWORD بـ .env.local.
 * الدخول نفسه صار مرة وحدة بـ tests/e2e/global-setup.ts (storageState).
 */

const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

const MOBILE_VIEWPORT = { width: 390, height: 844 };

// ملاحظة: ما منستخدم waitForLoadState("networkidle") — Next.js dev يبقي
// اتصال WebSocket مفتوح للـ HMR/Fast Refresh، فـ "networkidle" ما بيتحقق
// أبدًا ويعلّق الاختبار لحد timeout. "load" + مهلة قصيرة لـ fetch/render
// الجانب-العميل كافية هون.
async function gotoAndSettle(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("load");
  await page.waitForTimeout(1500);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  expect(
    overflow.scrollWidth,
    `document.documentElement.scrollWidth (${overflow.scrollWidth}) should not exceed window.innerWidth (${overflow.innerWidth})`,
  ).toBeLessThanOrEqual(overflow.innerWidth);
}

test.describe("تجاوب الموبايل — بدون تمرير أفقي", () => {
  test.setTimeout(90_000);
  test.use({ viewport: MOBILE_VIEWPORT, storageState: AUTH_FILE });

  test.skip(
    !EMAIL || !PASSWORD,
    "لازم تضبط E2E_TEST_EMAIL و E2E_TEST_PASSWORD بملف .env.local (حساب تجريبي مخصص للاختبارات فقط)",
  );

  const pages: Array<{ name: string; path: string }> = [
    { name: "الرئيسية", path: "/dashboard" },
    { name: "المواعيد (التقويم)", path: "/dashboard/appointments" },
    { name: "الفريق (الصلاحيات)", path: "/dashboard/team" },
    { name: "سجل النشاط", path: "/dashboard/activity" },
    { name: "تقارير المالية", path: "/dashboard/finance/reports" },
    { name: "الدفعات", path: "/dashboard/finance/payments" },
    { name: "الفواتير", path: "/dashboard/finance/invoices" },
    { name: "القضايا", path: "/dashboard/cases" },
    { name: "الموكلون", path: "/dashboard/clients" },
  ];

  for (const { name, path } of pages) {
    test(`${name} (${path}) بدون تمرير أفقي على 390px`, async ({ page }) => {
      await gotoAndSettle(page, path);

      await expectNoHorizontalOverflow(page);

      await page.screenshot({
        path: `test-results/mobile-screenshots/${path.replace(/\//g, "_")}.png`,
        fullPage: true,
      });
    });
  }

  test("قائمة التنبيهات (bell) لا تخرج عن الشاشة على 390px", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/dashboard");

    await page.getByRole("button", { name: /التنبيهات|Notifications/i }).click();

    const dialog = page.getByRole("dialog", { name: /التنبيهات|Notifications/i });
    await expect(dialog).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width);
    }

    await expectNoHorizontalOverflow(page);
  });

  test("التقويم الشهري لا يمرّر أفقيًا على 390px", async ({ page }) => {
    await gotoAndSettle(page, "/dashboard/appointments");

    const calendar = page.locator(".appointments-calendar");
    await expect(calendar).toBeVisible();

    await expectNoHorizontalOverflow(page);
  });
});
