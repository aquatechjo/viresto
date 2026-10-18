import { test, expect, type Page } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * Launch blocker found 2026-10-17: Settings could turn 2FA on, but the login
 * page had no step for the code, so anyone who enabled it was locked out.
 *
 * Full browser flow on a dedicated member (seeded by `npm run seed:e2e`,
 * which always resets it to 2FA off): enable 2FA in Settings → sign out →
 * sign in with email + password → the code step appears → a wrong code is
 * refused → the right code reaches the dashboard. 2FA is turned off again
 * at the end through the API.
 */

const EMAIL = "e2e-2fa@example.com";
const PASSWORD = process.env.E2E_TEST_PASSWORD;

const LOGIN_TIMEOUT_MS = 60_000;

function currentCode(secret: string) {
  return speakeasy.totp({ secret, encoding: "base32" });
}

async function submitCredentials(page: Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD!);
  await page.locator('button[type="submit"]').click();
}

async function sameOriginPost(page: Page, path: string, data?: unknown) {
  const origin = new URL(page.url()).origin;
  return page.request.post(path, {
    data,
    headers: { origin, "content-type": "application/json" },
  });
}

test.describe("تسجيل الدخول بالتحقق الثنائي", () => {
  test.skip(
    !PASSWORD,
    "لازم تضبط E2E_TEST_PASSWORD بملف .env.local وتشغّل npm run seed:e2e",
  );

  test("تفعيل 2FA ← خروج ← دخول برمز التحقق يوصل للداشبورد", async ({ page }) => {
    test.setTimeout(180_000);

    await submitCredentials(page);
    const codeStep = page.getByTestId("login-two-factor-step");

    await Promise.race([
      page.waitForURL(/\/dashboard/, { timeout: LOGIN_TIMEOUT_MS }),
      codeStep.waitFor({ timeout: LOGIN_TIMEOUT_MS }),
    ]);
    test.skip(
      await codeStep.isVisible(),
      `${EMAIL} still has 2FA on from an earlier run: run npm run seed:e2e to reset it`,
    );

    // 1. Enable 2FA in Settings, reading the manual key under the QR code.
    await page.goto("/dashboard/settings");
    await page.getByTestId("twofa-password").fill(PASSWORD!);
    await page.getByTestId("twofa-password").press("Enter");

    const manualKey = page.getByTestId("twofa-manual-key");
    await expect(manualKey).toBeVisible({ timeout: 30_000 });
    const secret = (await manualKey.innerText()).trim();
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);

    let disabled = false;

    try {
      await page.getByTestId("twofa-code").fill(currentCode(secret));
      await page
        .getByTestId("twofa-code")
        .locator("xpath=following-sibling::button[1]")
        .click();
      await expect(page.getByTestId("twofa-enabled")).toBeVisible({ timeout: 30_000 });

      // 2. Sign out.
      expect((await sameOriginPost(page, "/api/auth/logout")).ok()).toBe(true);
      await page.context().clearCookies();

      // 3. Email + password now lead to the code step, not the dashboard.
      await submitCredentials(page);
      await expect(codeStep).toBeVisible({ timeout: LOGIN_TIMEOUT_MS });
      await expect(page).toHaveURL(/\/login/);

      // A wrong code keeps the user on the code step.
      await page.locator('input[name="code"]').fill("000000");
      await page.locator('button[type="submit"]').click();
      // The refusal clears the field for another try.
      await expect(page.locator('input[name="code"]')).toHaveValue("", { timeout: 30_000 });
      await expect(codeStep).toBeVisible();
      await expect(page).toHaveURL(/\/login/);

      // 4. The right code signs in.
      await page.locator('input[name="code"]').fill(currentCode(secret));
      await page.locator('button[type="submit"]').click();
      await page.waitForURL(/\/dashboard/, { timeout: LOGIN_TIMEOUT_MS });

      const response = await sameOriginPost(page, "/api/auth/2fa/disable", {
        password: PASSWORD,
        code: currentCode(secret),
      });
      expect(response.ok(), await response.text()).toBe(true);
      disabled = true;
    } finally {
      if (!disabled) {
        // Best effort, so the next run starts with 2FA off; seed:e2e also resets it.
        await sameOriginPost(page, "/api/auth/2fa/disable", {
          password: PASSWORD,
          code: currentCode(secret),
        }).catch(() => undefined);
      }
    }
  });
});
