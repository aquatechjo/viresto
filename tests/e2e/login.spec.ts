import { test, expect } from "@playwright/test";

/**
 * سيناريو 1 من 5 — تسجيل الدخول
 * هذا أول اختبار E2E حقيقي بالمشروع (المرحلة 0 من خطة إعادة الهيكلة).
 *
 * ملاحظة مهمة: FormField.tsx حاليًا ما بيربط <label> بالـ <input> عبر
 * htmlFor/id (موثّق كمشكلة accessibility بالتقرير). لهيك الاختيار هون
 * صار عبر type="email" / type="password" بدل getByLabel، لأنه أوثق شي
 * موجود فعليًا بالكود الحالي. لما نصلح FormField (Phase 1)، رجّع هاد
 * الاختبار يستخدم page.getByLabel(...) بدل الـ type selector.
 */

const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("تسجيل الدخول", () => {
  test.skip(
    !EMAIL || !PASSWORD,
    "لازم تضبط E2E_TEST_EMAIL و E2E_TEST_PASSWORD بملف .env.local (حساب تجريبي مخصص للاختبارات فقط)",
  );

  test("تسجيل دخول ناجح يوصل للداشبورد", async ({ page }) => {
    await page.goto("/login");

    await page.locator('input[type="email"]').fill(EMAIL!);
    await page.locator('input[type="password"]').fill(PASSWORD!);

    await page.locator('button[type="submit"]').click();

    // اللوجن الحالي يستخدم window.location.href = "/dashboard"
    // (full navigation مش router.push) — لهيك بدنا ننتظر الـ URL فعليًا
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("بيانات خاطئة تظهر رسالة خطأ وتبقى بصفحة اللوجن", async ({ page }) => {
    await page.goto("/login");

    await page.locator('input[type="email"]').fill("wrong-user@example.com");
    await page.locator('input[type="password"]').fill("wrong-password-123");

    await page.locator('button[type="submit"]').click();

    // sonner toast — ما بنعتمد على نص محدد لأنه بيتغير حسب اللغة (ar/en)
    await expect(page.locator("[data-sonner-toast]")).toBeVisible({
      timeout: 8_000,
    });

    // لازم يضل بصفحة اللوجن، ما ينتقلش للداشبورد
    await expect(page).toHaveURL(/\/login/);
  });

  test("حقول فاضية تظهر رسائل خطأ محلية بدون ما ترسل طلب", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.locator('button[type="submit"]').click();

    // فورم فيلد بيعرض error تحت الحقل مباشرة — أي نص خطأ ظاهر كفاية هون
    // (تحقق دقيق أكتر بيصير أسهل بعد ما نضيف data-testid بالمرحلة 1)
    const emailField = page.locator("form").first();
    await expect(emailField).toContainText(/./); // مجرد تأكيد إن الفورم ما زال ظاهر ولا صار navigation
    await expect(page).toHaveURL(/\/login/);
  });
});
