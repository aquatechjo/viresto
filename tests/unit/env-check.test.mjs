import assert from "node:assert/strict";
import test from "node:test";
import { validateEnvironment } from "../../scripts/check-env.mjs";

function validEnvironment() {
  return {
    DATABASE_URL: "postgresql://user:password@db.example.com/app",
    DIRECT_URL: "postgresql://user:password@db.example.com/app",
    CLOUDINARY_CLOUD_NAME: "cloud",
    CLOUDINARY_API_KEY: "api-key",
    CLOUDINARY_API_SECRET: "api-secret",
    UPSTASH_REDIS_REST_URL: "https://redis.example.com",
    UPSTASH_REDIS_REST_TOKEN: "redis-token",
    RESEND_API_KEY: "resend-key",
    EMAIL_FROM: "Viresto <no-reply@example.com>",
    CRON_SECRET: "c".repeat(32),
    ALLOWED_SERVER_ACTION_ORIGINS: "virestojo.com,www.virestojo.com",
    JWT_SECRET: "j".repeat(32),
    PASSWORD_RESET_SECRET: "p".repeat(32),
    VERIFICATION_SECRET: "v".repeat(32),
    SEARCH_HASH_SECRET: "s".repeat(32),
    ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
    ENCRYPTION_KEY_ID: "key-2026-01",
    APP_URL: "https://www.virestojo.com",
    NEXT_PUBLIC_APP_URL: "https://www.virestojo.com",
    PUBLIC_REGISTER_ENABLED: "false",
    NEXT_PUBLIC_REGISTER_ENABLED: "false",
    TURNSTILE_ENABLED: "false",
  };
}

test("production environment validation accepts separated secure values", () => {
  const result = validateEnvironment(validEnvironment());
  assert.deepEqual(result.errors, []);
});

test("environment validation rejects mismatched registration flags", () => {
  const env = validEnvironment();
  env.PUBLIC_REGISTER_ENABLED = "true";

  const result = validateEnvironment(env);
  assert.ok(
    result.errors.some((message) => message.includes("must match")),
  );
  assert.ok(
    result.errors.some((message) => message.includes("TURNSTILE_ENABLED")),
  );
});

test("environment validation verifies previous encryption keys", () => {
  const env = validEnvironment();
  env.ENCRYPTION_PREVIOUS_KEYS = "bad-entry";

  const result = validateEnvironment(env);
  assert.ok(
    result.errors.some((message) =>
      message.includes("ENCRYPTION_PREVIOUS_KEYS"),
    ),
  );
});

test("environment validation accepts a separate health-check secret", () => {
  const env = validEnvironment();
  env.HEALTHCHECK_SECRET = "h".repeat(32);

  const result = validateEnvironment(env);
  assert.deepEqual(result.errors, []);
  assert.equal(
    result.warnings.some((message) => message.includes("HEALTHCHECK_SECRET")),
    false,
  );
});

test("environment validation rejects weak or reused health-check secrets", () => {
  const weakEnv = validEnvironment();
  weakEnv.HEALTHCHECK_SECRET = "short";
  const weakResult = validateEnvironment(weakEnv);
  assert.ok(
    weakResult.errors.some((message) => message.includes("HEALTHCHECK_SECRET")),
  );

  const reusedEnv = validEnvironment();
  reusedEnv.HEALTHCHECK_SECRET = reusedEnv.CRON_SECRET;
  const reusedResult = validateEnvironment(reusedEnv);
  assert.ok(
    reusedResult.errors.some((message) => message.includes("must use different secrets")),
  );
});
