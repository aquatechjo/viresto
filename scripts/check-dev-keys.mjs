import nextEnv from "@next/env";
import { pathToFileURL } from "node:url";

// Runs before `npm run dev` (predev), from next.config.js when the
// development server starts (so a bare `next dev` is covered too), and
// before the local-only Prisma scripts (`--database`). Never before a
// build (AUDIT_REPORT.md C1): Vercel builds production on purpose.
//
// A development server must not hold production billing or email keys:
// one click on a local billing page would open a real Polar checkout or
// change a real subscription, and local emails would go out from the
// production sender. Set ALLOW_PRODUCTION_KEYS_IN_DEV=1 to start anyway
// (still warns).
//
// Nor may it touch the production database. Neon puts the branch's
// endpoint id (ep-...) first in the host, and it is the only part of the
// URL that differs between branches (database, user and region are the
// same; the password changes on rotation). PROD_DB_ENDPOINT_ID names the
// production one. Unset while the URL is on Neon, we cannot tell, so we
// refuse. No override: there is no reason to develop on production.

const { loadEnvConfig } = nextEnv;

export const PRODUCTION_DOMAIN = "virestojo.com";

const DATABASE_URL_NAMES = ["DATABASE_URL", "DIRECT_URL"];

function value(env, name) {
  return String(env[name] ?? "").trim();
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isProductionHost(host) {
  return host === PRODUCTION_DOMAIN || host.endsWith(`.${PRODUCTION_DOMAIN}`);
}

/** The Neon endpoint id of a database URL (pooled or direct), or "". */
export function neonEndpointId(url) {
  const host = hostOf(url);
  if (!host.endsWith(".neon.tech")) return "";
  return host.split(".")[0].replace(/-pooler$/, "");
}

/** Problems with running `next dev` on this environment; empty when safe. */
export function findProductionKeysInDev(env) {
  const problems = [];

  const polarEnvironment = value(env, "POLAR_ENVIRONMENT");
  if (value(env, "POLAR_ACCESS_TOKEN") && polarEnvironment !== "sandbox") {
    problems.push(
      `POLAR_ACCESS_TOKEN is set with POLAR_ENVIRONMENT=${polarEnvironment || "(empty)"}: locally only a Polar sandbox token with POLAR_ENVIRONMENT=sandbox is allowed, or local checkouts, plan changes and refund handling could act on real customers.`,
    );
  }

  const sender = value(env, "EMAIL_FROM").match(/@([^>\s]+)/)?.[1]?.toLowerCase() ?? "";
  if (value(env, "RESEND_API_KEY") && isProductionHost(sender)) {
    problems.push(
      `RESEND_API_KEY can send from the production domain (EMAIL_FROM is @${sender}): local emails would reach real people from the live sender. Leave RESEND_API_KEY empty locally (codes are printed to the server log) or use a key for a separate test domain.`,
    );
  }

  for (const name of ["APP_URL", "NEXT_PUBLIC_APP_URL"]) {
    if (isProductionHost(hostOf(value(env, name)))) {
      problems.push(
        `${name} points at production (${value(env, name)}): email links and Polar return URLs from this machine would open the live site. Use http://localhost:3000 locally.`,
      );
    }
  }

  return problems;
}

/** Problems with the database this environment points at; empty when safe. */
export function findProductionDatabaseInDev(env) {
  const problems = [];
  const productionEndpoint = value(env, "PROD_DB_ENDPOINT_ID").toLowerCase();

  for (const name of DATABASE_URL_NAMES) {
    const endpoint = neonEndpointId(value(env, name));
    if (!endpoint) continue;

    if (!productionEndpoint) {
      problems.push(
        `${name} is a Neon database but PROD_DB_ENDPOINT_ID is not set, so it cannot be told apart from production. Set PROD_DB_ENDPOINT_ID to the production branch's endpoint id (ep-...) in .env.`,
      );
    } else if (endpoint === productionEndpoint) {
      problems.push(
        `${name} points at the PRODUCTION database (Neon endpoint ${endpoint}). Use the Neon dev branch locally (see OPERATIONS.md, "Development environment").`,
      );
    }
  }

  return problems;
}

function printProblems(title, problems) {
  const bar = "=".repeat(78);
  console.error(`\n${bar}`);
  console.error(` ${title}`);
  console.error(bar);
  for (const problem of problems) console.error(` - ${problem}`);
  console.error(bar);
}

/**
 * Loads the env files like Next.js does and checks them. Returns false when
 * the development environment must not start; prints why.
 */
export function checkDevelopmentEnvironment({ databaseOnly = false } = {}) {
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} });

  const databaseProblems = findProductionDatabaseInDev(process.env);
  if (databaseProblems.length > 0) {
    printProblems("PRODUCTION DATABASE IN A DEVELOPMENT ENVIRONMENT", databaseProblems);
    console.error(" Refusing to start. Fix DATABASE_URL / DIRECT_URL in .env (no override).\n");
    return false;
  }
  if (databaseOnly) return true;

  const problems = findProductionKeysInDev(process.env);
  if (problems.length === 0) return true;

  printProblems("PRODUCTION KEYS IN A DEVELOPMENT ENVIRONMENT", problems);

  if (process.env.ALLOW_PRODUCTION_KEYS_IN_DEV === "1") {
    console.error(" ALLOW_PRODUCTION_KEYS_IN_DEV=1 is set: starting anyway.\n");
    return true;
  }

  console.error(" Refusing to start. Fix .env (see .env.example), or set");
  console.error(" ALLOW_PRODUCTION_KEYS_IN_DEV=1 to start anyway.\n");
  return false;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const ok = checkDevelopmentEnvironment({
    databaseOnly: process.argv.includes("--database"),
  });
  if (!ok) process.exit(1);
}
