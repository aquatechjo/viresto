import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

// Integration tests run against a real Postgres, never a mock. Each run
// migrates a brand-new schema (`it_<random>`) with `prisma migrate deploy`
// and drops it afterwards, so existing tables in that database are never
// read or written.
//
// Safety: the database must be named explicitly in INTEGRATION_DATABASE_URL
// (never DATABASE_URL, which may point anywhere), and its host must be
// localhost (CI) or E2E_ALLOWED_DATABASE_HOST (the Neon dev branch; the
// "-pooler" suffix is ignored). Anything else is refused before connecting.

const ROOT = path.resolve(__dirname, "../../..");

export type IntegrationDatabase = {
  url: string;
  schema: string;
};

function normalizeHost(host: string) {
  return host.toLowerCase().replace("-pooler.", ".");
}

// Values the app reads at import time. Set explicitly so a local .env
// (which may hold real keys) can never leak into a test run.
const TEST_ENV: Record<string, string> = {
  NODE_ENV: "test",
  JWT_SECRET: "integration-jwt-secret-000000000000001",
  PASSWORD_RESET_SECRET: "integration-reset-secret-00000000000001",
  VERIFICATION_SECRET: "integration-verify-secret-0000000000001",
  SEARCH_HASH_SECRET: "integration-search-secret-0000000000001",
  ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  ENCRYPTION_KEY_ID: "integration",
  POLAR_WEBHOOK_SECRET: "integration-polar-webhook-secret-000001",
  PUBLIC_REGISTER_ENABLED: "true",
  TURNSTILE_ENABLED: "false",
  AUTH_CACHE_TTL_MS: "0",
  // Remote DB from a dev machine: allow multi-query transactions to finish
  // (production keeps Prisma's 5 s default; see src/lib/prisma.ts).
  PRISMA_TRANSACTION_TIMEOUT_MS: "30000",
  APP_URL: "http://localhost:3000",
};

// Never talk to external services from an integration test. These are set
// to "" rather than deleted: importing @prisma/client loads the root .env and
// fills in any variable that is missing, which used to bring the real keys
// (including Upstash, so rate-limit counters persisted across runs) back.
const STRIPPED_ENV = [
  "ENCRYPTION_PREVIOUS_KEYS",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "RESEND_API_KEY",
  "POLAR_ACCESS_TOKEN",
  "OPENAI_API_KEY",
  "CLOUDINARY_API_SECRET",
  "E2E_RATE_LIMIT_BYPASS",
];

export function setupIntegrationDatabase(): IntegrationDatabase {
  loadEnvConfig(ROOT, true, { info() {}, error() {} });

  const base = process.env.INTEGRATION_DATABASE_URL?.trim();

  if (!base) {
    throw new Error(
      "INTEGRATION_DATABASE_URL is required (a direct Postgres URL for the dev branch or a local/CI database). See .env.example.",
    );
  }

  const url = new URL(base);
  const host = normalizeHost(url.hostname);
  const allowedHost = process.env.E2E_ALLOWED_DATABASE_HOST?.trim();
  const isLocal = host === "localhost" || host === "127.0.0.1";
  const isAllowedDev = Boolean(allowedHost) && host === normalizeHost(allowedHost!);

  if (!isLocal && !isAllowedDev) {
    throw new Error(
      `Refusing to run integration tests against host "${url.hostname}": only localhost or E2E_ALLOWED_DATABASE_HOST is allowed.`,
    );
  }

  // The app's own database (DATABASE_URL / DIRECT_URL, production since
  // 2026-10-23) is never a test database, even if the allowlist names it.
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing to run integration tests in a Vercel production environment.");
  }

  if (!isLocal) {
    for (const name of ["DATABASE_URL", "DIRECT_URL"] as const) {
      const appUrl = process.env[name]?.trim();
      if (!appUrl) continue;

      let appHost = "";
      try {
        appHost = normalizeHost(new URL(appUrl).hostname);
      } catch {
        continue;
      }

      if (appHost === host) {
        throw new Error(
          `Refusing to run integration tests: INTEGRATION_DATABASE_URL points at the same host as ${name} ("${url.hostname}"), the app's own database.`,
        );
      }
    }
  }

  const schema = `it_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
  url.searchParams.set("schema", schema);
  const schemaUrl = url.toString();

  for (const name of STRIPPED_ENV) process.env[name] = "";
  Object.assign(process.env, TEST_ENV, {
    DATABASE_URL: schemaUrl,
    DIRECT_URL: schemaUrl,
  });

  const result = spawnSync(
    process.execPath,
    [path.join(ROOT, "node_modules/prisma/build/index.js"), "migrate", "deploy"],
    {
      cwd: ROOT,
      env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
      encoding: "utf8",
    },
  );

  if (result.status !== 0) {
    throw new Error(`prisma migrate deploy failed:\n${result.stdout}\n${result.stderr}`);
  }

  // Prisma qualifies every table with the test schema, but trigger
  // functions (e.g. set_payment_client_id_from_case) name tables
  // unqualified and would resolve them through the session's default
  // search_path, i.e. the real public schema. Pin each function to the test
  // schema. (Production uses public only, so it is unaffected.)
  const pinned = spawnSync(
    process.execPath,
    [
      path.join(ROOT, "node_modules/prisma/build/index.js"),
      "db",
      "execute",
      "--url",
      schemaUrl,
      "--stdin",
    ],
    {
      cwd: ROOT,
      env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
      encoding: "utf8",
      input: `DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = '${schema}'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = %I', fn.signature, '${schema}');
  END LOOP;
END $$;`,
    },
  );

  if (pinned.status !== 0) {
    throw new Error(`pinning function search_path failed:\n${pinned.stdout}\n${pinned.stderr}`);
  }

  return { url: schemaUrl, schema };
}

export async function dropIntegrationSchema(
  db: { $executeRawUnsafe(query: string): Promise<unknown>; $disconnect(): Promise<void> },
  schema: string,
) {
  if (!/^it_[a-z0-9_]+$/.test(schema)) throw new Error(`Unexpected schema name ${schema}`);
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await db.$disconnect();
}

export function runScript(scriptPath: string, args: string[], databaseUrl: string) {
  return spawnSync(
    process.execPath,
    ["--import", "tsx", path.join(ROOT, scriptPath), ...args],
    {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl },
      encoding: "utf8",
    },
  );
}
