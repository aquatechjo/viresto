import nextEnv from "@next/env";
import { pathToFileURL } from "node:url";

const { loadEnvConfig } = nextEnv;

const REQUIRED_VALUES = [
  "DATABASE_URL",
  "DIRECT_URL",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "CRON_SECRET",
  "ALLOWED_SERVER_ACTION_ORIGINS",
];

const SECRET_RULES = [
  ["JWT_SECRET", 32],
  ["PASSWORD_RESET_SECRET", 32],
  ["VERIFICATION_SECRET", 32],
  ["SEARCH_HASH_SECRET", 32],
  ["CRON_SECRET", 32],
];

function isPlaceholder(value) {
  return /^(?:change-me|your[_-]|replace-me|example|test-secret)/i.test(
    value.trim(),
  );
}

function isValidBase64Key(value) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  return Buffer.from(value, "base64").length === 32;
}

function isPostgresUrl(value) {
  return /^postgres(?:ql)?:\/\//i.test(value);
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function validateEnvironment(env) {
  const errors = [];
  const warnings = [];
  const valueOf = (name) => env[name]?.trim() || "";

  for (const name of REQUIRED_VALUES) {
    if (!valueOf(name)) errors.push(`${name} is required`);
  }

  for (const [name, minimumLength] of SECRET_RULES) {
    const value = valueOf(name);

    if (!value) {
      errors.push(`${name} is required`);
    } else if (value.length < minimumLength || isPlaceholder(value)) {
      errors.push(
        `${name} must be a non-placeholder secret of at least ${minimumLength} characters`,
      );
    }
  }

  const encryptionKey = valueOf("ENCRYPTION_KEY");
  if (!encryptionKey) {
    errors.push("ENCRYPTION_KEY is required");
  } else if (!isValidBase64Key(encryptionKey)) {
    errors.push(
      "ENCRYPTION_KEY must be valid base64 that decodes to exactly 32 bytes",
    );
  }

  const encryptionKeyId = valueOf("ENCRYPTION_KEY_ID") || "primary";
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(encryptionKeyId)) {
    errors.push("ENCRYPTION_KEY_ID has an invalid format");
  }

  const previousIds = new Set();
  for (const rawEntry of valueOf("ENCRYPTION_PREVIOUS_KEYS").split(",")) {
    const entry = rawEntry.trim();
    if (!entry) continue;

    const separator = entry.indexOf("=");
    const keyId = separator > 0 ? entry.slice(0, separator).trim() : "";
    const encodedKey = separator > 0 ? entry.slice(separator + 1).trim() : "";

    if (
      !/^[A-Za-z0-9._-]{1,40}$/.test(keyId) ||
      !isValidBase64Key(encodedKey)
    ) {
      errors.push(
        "ENCRYPTION_PREVIOUS_KEYS must contain valid keyId=base64 entries",
      );
      break;
    }

    if (keyId === encryptionKeyId || previousIds.has(keyId)) {
      errors.push(`Duplicate encryption key id: ${keyId}`);
      break;
    }

    previousIds.add(keyId);
  }

  for (const name of ["DATABASE_URL", "DIRECT_URL"]) {
    const value = valueOf(name);
    if (value && !isPostgresUrl(value)) {
      errors.push(`${name} must be a PostgreSQL connection URL`);
    }
  }

  const appUrl = valueOf("APP_URL") || valueOf("NEXT_PUBLIC_APP_URL");
  if (!appUrl) {
    errors.push("APP_URL or NEXT_PUBLIC_APP_URL is required");
  } else if (!isHttpsUrl(appUrl)) {
    errors.push("The production app URL must use https://");
  }

  const allowedOrigins = valueOf("ALLOWED_SERVER_ACTION_ORIGINS")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (
    allowedOrigins.some(
      (origin) => !/^[A-Za-z0-9.-]+(?::\d+)?$/.test(origin),
    )
  ) {
    errors.push(
      "ALLOWED_SERVER_ACTION_ORIGINS must contain hostnames without paths or protocols",
    );
  }

  const publicRegisterEnabled =
    valueOf("PUBLIC_REGISTER_ENABLED") === "true";
  const clientRegisterEnabled =
    valueOf("NEXT_PUBLIC_REGISTER_ENABLED") === "true";

  if (publicRegisterEnabled !== clientRegisterEnabled) {
    errors.push(
      "PUBLIC_REGISTER_ENABLED and NEXT_PUBLIC_REGISTER_ENABLED must match",
    );
  }

  if (publicRegisterEnabled) {
    if (valueOf("TURNSTILE_ENABLED") !== "true") {
      errors.push(
        "TURNSTILE_ENABLED must be true when public registration is enabled",
      );
    }

    for (const name of [
      "TURNSTILE_SECRET_KEY",
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    ]) {
      if (!valueOf(name)) {
        errors.push(`${name} is required when public registration is enabled`);
      }
    }
  }

  const secretValues = SECRET_RULES
    .map(([name]) => [name, valueOf(name)])
    .filter(([, value]) => value);

  for (let index = 0; index < secretValues.length; index += 1) {
    for (let other = index + 1; other < secretValues.length; other += 1) {
      if (secretValues[index][1] === secretValues[other][1]) {
        errors.push(
          `${secretValues[index][0]} and ${secretValues[other][0]} must use different secrets`,
        );
      }
    }
  }

  if (!valueOf("OPENAI_API_KEY")) {
    warnings.push(
      "OPENAI_API_KEY is missing; AI features will remain unavailable",
    );
  }

  if (!valueOf("APP_URL")) {
    warnings.push(
      "APP_URL is not set; email links will fall back to NEXT_PUBLIC_APP_URL",
    );
  }

  return {
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
  };
}

export function printEnvironmentResult(result, strict) {
  for (const warning of result.warnings) {
    console.warn(`[ENV_WARNING] ${warning}`);
  }

  if (result.errors.length === 0) {
    console.log("[ENV_OK] Environment configuration passed validation.");
    return true;
  }

  const output = strict ? console.error : console.warn;
  const label = strict ? "ENV_ERROR" : "ENV_WARNING";

  for (const error of result.errors) {
    output(`[${label}] ${error}`);
  }

  if (!strict) {
    console.warn(
      "[ENV_WARNING] Development build continues; production deployment would be blocked.",
    );
  }

  return !strict;
}

async function main() {
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

  const strict =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.ENV_VALIDATION_STRICT === "true";
  const valid = printEnvironmentResult(
    validateEnvironment(process.env),
    strict,
  );

  if (!valid) process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
