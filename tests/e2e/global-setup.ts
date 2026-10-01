import path from "node:path";
import fs from "node:fs";
import { chromium, type FullConfig } from "@playwright/test";

/**
 * يسجّل دخول مرة واحدة قبل كل السويت، ويحفظ storageState لإعادة استخدامه
 * من أي spec عبر test.use({ storageState: AUTH_FILE }) بدل ما يسجّل كل
 * اختبار دخول لحاله (تسجيل الدخول بطيء بالتطوير: 8-15 ثانية+).
 *
 * login.spec.ts ما بيستخدم هاد الملف عمدًا — هو بيختبر نموذج تسجيل الدخول
 * نفسه، فلازم يبلّش من سياق غير مسجّل دخول.
 */

export const AUTH_FILE = path.join(__dirname, "..", ".auth", "user.json");

const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

const LOGIN_TIMEOUT_MS = 60_000;

export default async function globalSetup(config: FullConfig) {
  const baseURL =
    config.projects[0]?.use?.baseURL ||
    process.env.E2E_BASE_URL ||
    "http://localhost:3000";

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  if (!EMAIL || !PASSWORD) {
    // ما في حساب اختبار مضبوط — منكتب storageState فاضي وصالح حتى ما
    // ينكسر أي spec بيحاول يحمّله (هو أصلًا رح يتخطّى بـ test.skip).
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });

  try {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: LOGIN_TIMEOUT_MS });

    await page.context().storageState({ path: AUTH_FILE });
  } finally {
    await browser.close();
  }
}
