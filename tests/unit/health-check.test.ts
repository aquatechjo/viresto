import assert from "node:assert/strict";
import test from "node:test";
import {
  getHealthServiceConfiguration,
  isHealthCheckAuthorized,
} from "../../src/lib/health-check";

test("health authorization accepts only the configured bearer token", () => {
  const secret = "h".repeat(32);

  assert.equal(isHealthCheckAuthorized(`Bearer ${secret}`, secret), true);
  assert.equal(isHealthCheckAuthorized(`bearer ${secret}`, secret), true);
  assert.equal(isHealthCheckAuthorized(`Bearer ${"x".repeat(32)}`, secret), false);
  assert.equal(isHealthCheckAuthorized(secret, secret), false);
  assert.equal(isHealthCheckAuthorized(null, secret), false);
  assert.equal(isHealthCheckAuthorized(`Bearer ${secret}`, undefined), false);
});

test("health configuration reports required integrations without exposing values", () => {
  const configuration = getHealthServiceConfiguration({
    UPSTASH_REDIS_REST_URL: "https://redis.example.com",
    UPSTASH_REDIS_REST_TOKEN: "redis-token",
    CLOUDINARY_CLOUD_NAME: "cloud",
    CLOUDINARY_API_KEY: "key",
    CLOUDINARY_API_SECRET: "secret",
    RESEND_API_KEY: "resend-key",
    EMAIL_FROM: "Viresto <no-reply@example.com>",
  });

  assert.deepEqual(configuration, {
    redis: true,
    cloudinary: true,
    email: true,
    ai: false,
  });
});

test("health configuration fails closed when one integration value is missing", () => {
  const configuration = getHealthServiceConfiguration({
    UPSTASH_REDIS_REST_URL: "https://redis.example.com",
    CLOUDINARY_CLOUD_NAME: "cloud",
    CLOUDINARY_API_KEY: "key",
    RESEND_API_KEY: "resend-key",
  });

  assert.equal(configuration.redis, false);
  assert.equal(configuration.cloudinary, false);
  assert.equal(configuration.email, false);
});
