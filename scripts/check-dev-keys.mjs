import nextEnv from "@next/env";
import { pathToFileURL } from "node:url";

// Runs before `npm run dev` (predev), never before a build (AUDIT_REPORT.md
// C1). A development server must not hold production billing or email
// keys: one click on a local billing page would open a real Polar checkout
// or change a real subscription, and local emails would go out from the
// production sender. Builds are unaffected (Vercel builds production on
// purpose); this only stops `next dev`.
//
// Set ALLOW_PRODUCTION_KEYS_IN_DEV=1 to start anyway (still warns).

const { loadEnvConfig } = nextEnv;

export const PRODUCTION_DOMAIN = "virestojo.com";

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

/** Problems with running `next dev` on this environment; empty when safe. */
export function findProductionKeysInDev(env) {
  const problems = [];

  if (value(env, "POLAR_ACCESS_TOKEN") && value(env, "POLAR_ENVIRONMENT") === "production") {
    problems.push(
      "POLAR_ACCESS_TOKEN is a production token (POLAR_ENVIRONMENT=production): local checkouts, plan changes and refund handling would act on real customers. Use a Polar sandbox token and POLAR_ENVIRONMENT=sandbox.",
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

function main() {
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} });

  const problems = findProductionKeysInDev(process.env);
  if (problems.length === 0) return;

  const allowed = process.env.ALLOW_PRODUCTION_KEYS_IN_DEV === "1";
  const bar = "=".repeat(78);

  console.error(`\n${bar}`);
  console.error(" PRODUCTION KEYS IN A DEVELOPMENT ENVIRONMENT");
  console.error(bar);
  for (const problem of problems) console.error(` - ${problem}`);
  console.error(bar);

  if (allowed) {
    console.error(" ALLOW_PRODUCTION_KEYS_IN_DEV=1 is set: starting anyway.");
    console.error(`${bar}\n`);
    return;
  }

  console.error(" `npm run dev` refuses to start. Fix .env / .env.local (see .env.example),");
  console.error(" or set ALLOW_PRODUCTION_KEYS_IN_DEV=1 to start anyway.");
  console.error(`${bar}\n`);
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
