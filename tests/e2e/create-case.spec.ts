import { test, expect } from "@playwright/test";

/**
 * سيناريو 2 من 5 — إنشاء قضية جديدة
 *
 * ملاحظات مبنية على فحص فعلي لـ src/app/dashboard/cases/page.tsx:
 *
 * 1. فورم "إضافة قضية" يتطلب 3 حقول:
 *      - عميل (clientId)
 *      - عنوان القضية (title)
 *      - المحامي المسؤول (leadLawyerId)
 *    رسالة الخطأ صارت تذكر الحقول الناقصة بالضبط (commit 71326bb).
 *
 * 2. خانة اختيار العميل (client) هي autocomplete: بمجرد ما تفتح المودال
 *    وتركّز على الحقل، بيصير fetch لقائمة العملاء تلقائيًا (حتى بدون
 *    كتابة أي نص بحث) بعد 250ms debounce. لهيك ما في داعي نكتب اسم
 *    عميل، بس نفتح القائمة ونستنى الزر يظهر.
 *
 * 3. "المحامي المسؤول" هو <select> عادي (مش مكوّن مخصص). بما إنه
 *    الحساب التجريبي هو صاحب أول تينانت، بينسجل تلقائيًا بـ role=ADMIN
 *    (مؤكد من كود /api/auth/register)، فبيظهر كخيار وحيد بالقائمة.
 *    لهيك منختاره بالـ index (1) بدل الاسم، لأنه الاسم ممكن يختلف
 *    حسب شو كتبت وقت التسجيل.
 *
 * 4. قبل هالاختبار، لازم يكون في عميل واحد على الأقل بالنظام. بدل ما
 *    نعتمد على فورم "إضافة عميل" (تبعية إضافية على صفحة تانية)،
 *    منزرع عميل تجريبي مباشرة عبر API. هاد بيحتاج Origin header يدوي
 *    لأنه lib/csrf.ts بيرفض أي POST بدون Origin مطابق للـ Host —
 *    فحص أمني حقيقي موجود بالمشروع، مش قصور بالاختبار.
 */

const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";

// Login takes 8–15 s against the dev server, so the login wait and the
// overall test budget are sized for that, not for production.
const LOGIN_TIMEOUT_MS = 45_000;
const UI_TIMEOUT_MS = 15_000;

test.describe("إنشاء قضية جديدة", () => {
  test.setTimeout(120_000); // dev mode compile + slow login — مش مشكلة كود
  test.skip(
    !EMAIL || !PASSWORD,
    "لازم تضبط E2E_TEST_EMAIL و E2E_TEST_PASSWORD بملف .env.local",
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(EMAIL!);
    await page.locator('input[type="password"]').fill(PASSWORD!);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: LOGIN_TIMEOUT_MS });
  });

  test("إنشاء قضية جديدة بعميل ومحامي مسؤول تظهر بالقائمة", async ({
    page,
  }) => {
    // --- تحضير: زرع عميل تجريبي فريد عبر API (مش عبر UI) ---
    const uniqueSuffix = Date.now();
    const clientName = `عميل اختبار ${uniqueSuffix}`;

    const clientRes = await page.request.post("/api/clients", {
      headers: { origin: BASE_URL },
      data: {
        name: clientName,
        phone: "0791234567",
        nationalId: "9988776655",
      },
    });

    expect(
      clientRes.ok(),
      `فشل إنشاء العميل التجريبي: ${await clientRes.text()}`,
    ).toBeTruthy();

    // --- افتح صفحة القضايا وابدأ إنشاء قضية جديدة ---
    await page.goto("/dashboard/cases");

    // في زرين بنفس النص (بالهيدر وبحالة القائمة الفاضية) — ناخذ الأول
    await page
      .getByRole("button", { name: /قضية جديدة|New case/ })
      .first()
      .click();

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // اختيار العميل: ركّز على حقل البحث، استنى القائمة، اختر العميل
    const clientInput = modal.getByTestId("case-client-search");
    await clientInput.click();
    await modal
      .getByRole("button", { name: clientName })
      .click({ timeout: UI_TIMEOUT_MS });

    // عنوان القضية
    const caseTitle = `قضية اختبار E2E ${uniqueSuffix}`;
    await modal.getByTestId("case-title").fill(caseTitle);

    // المحامي المسؤول — select عادي، اختر أول خيار حقيقي (index 1، لأنه
    // index 0 هو الخيار المعطّل "اختر المحامي المسؤول...")
    await modal.locator("select").selectOption({ index: 1 });

    // إرسال الفورم
    await modal.getByRole("button", { name: /حفظ|Save/ }).click();

    // النجاح: المودال لازم يسكر (closeCreateCaseModal بعد نجاح الطلب)
    await expect(modal).not.toBeVisible({ timeout: UI_TIMEOUT_MS });

    // والقضية الجديدة لازم تظهر بالقائمة بعد إعادة التحميل التلقائي (load())
    // الجدول عنده نسخة mobile-cards ونسخة desktop-table بنفس الوقت بالـ DOM
    // (وحدة ظاهرة حسب حجم الشاشة) — بنحدد نسخة الديسكتوب صراحة عشان ما
    // يصير strict-mode violation من وجود العنوان مرتين.
    await expect(
      page
        .locator('[data-vds-view="desktop-table"]')
        .getByText(caseTitle),
    ).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });
  });

  test("محاولة الحفظ بدون اختيار عميل أو محامي تُظهر خطأ وتبقي المودال مفتوح", async ({
    page,
  }) => {
    await page.goto("/dashboard/cases");

    await page
      .getByRole("button", { name: /قضية جديدة|New case/ })
      .first()
      .click();

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // نملي بس عنوان القضية، نسيب العميل والمحامي فاضيين
    await modal.getByTestId("case-title").fill("قضية بدون عميل");

    await modal.getByRole("button", { name: /حفظ|Save/ }).click();

    // توست خطأ محلي (requiredError) — يظهر بدون ما يرسل طلب فعلي للسيرفر
    await expect(page.locator("[data-sonner-toast]")).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });

    // المودال لازم يضل مفتوح، ما ينسكرش عالخطأ
    await expect(modal).toBeVisible();
  });
});
