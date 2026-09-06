import { loadEnvFile } from "node:process";

try {
  loadEnvFile(".env.local");
} catch {
  // .env.local غير موجود محليًا — عادي، بيعتمد على متغيرات البيئة الحقيقية (مثلاً بـ CI)
}

import { defineConfig, devices } from "@playwright/test";

// يقرأ العنوان من .env.local (E2E_BASE_URL) أو يفتري dev server محلي
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // معطّل مبدئيًا لأنه فيه سيناريوهات تعتمد على بيانات مشتركة (تسجيل دخول)
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "ar-JO",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // شغّل السيرفر تلقائيًا إذا مش شغال أصلًا (مفيد محليًا وبالـ CI)
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
