const DEFAULT_BASE_URL = "https://www.virestojo.com";
const REQUEST_TIMEOUT_MS = 15_000;
const ATTEMPTS = 3;

const baseUrl = normalizeBaseUrl(process.env.PRODUCTION_URL || DEFAULT_BASE_URL);
const healthSecret = process.env.HEALTHCHECK_SECRET?.trim();

const checks = [
  { name: "homepage", path: "/", status: 200, contentType: "text/html", includes: "Viresto" },
  { name: "login", path: "/login", status: 200, contentType: "text/html" },
  { name: "pricing", path: "/pricing", status: 200, contentType: "text/html" },
  { name: "privacy", path: "/privacy", status: 200, contentType: "text/html" },
  { name: "terms", path: "/terms", status: 200, contentType: "text/html" },
  { name: "subscription policy", path: "/subscription-policy", status: 200, contentType: "text/html" },
  { name: "sitemap", path: "/sitemap.xml", status: 200, contentType: "xml" },
  { name: "liveness", path: "/api/perf/ping", status: 200, jsonOk: true },
  { name: "protected auth", path: "/api/perf/auth", status: 401 },
  { name: "protected database", path: "/api/perf/db", status: 401 },
  { name: "protected readiness", path: "/api/health", status: 401 },
  { name: "protected notification cron", path: "/api/cron/generate-notifications", status: 401 },
  { name: "protected retention cron", path: "/api/cron/prune-activity", status: 401 },
];

if (healthSecret) {
  checks.push({
    name: "authenticated readiness",
    path: "/api/health",
    status: 200,
    jsonOk: true,
    authorization: `Bearer ${healthSecret}`,
  });
} else {
  console.warn("[SMOKE_WARNING] HEALTHCHECK_SECRET is not configured; readiness check skipped.");
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("PRODUCTION_URL must use HTTPS");
  }
  return url.toString().replace(/\/$/, "");
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function executeCheck(check) {
  const url = `${baseUrl}${check.path}`;
  let lastError;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: check.authorization ? { Authorization: check.authorization } : undefined,
        redirect: "follow",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const body = await response.text();
      const contentType = response.headers.get("content-type") || "";

      if (response.status !== check.status) {
        throw new Error(`expected HTTP ${check.status}, received ${response.status}`);
      }
      if (check.contentType && !contentType.includes(check.contentType)) {
        throw new Error(`unexpected content-type: ${contentType || "missing"}`);
      }
      if (check.includes && !body.includes(check.includes)) {
        throw new Error(`response is missing ${check.includes}`);
      }
      if (check.jsonOk) {
        const json = JSON.parse(body);
        if (json.ok !== true) throw new Error("JSON readiness flag is not true");
      }

      console.log(`[SMOKE_OK] ${check.name} (${response.status})`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < ATTEMPTS) await wait(attempt * 500);
    }
  }

  const message = lastError instanceof Error ? lastError.message : "unknown error";
  throw new Error(`${check.name}: ${message}`);
}

console.log(`[SMOKE_START] ${baseUrl}`);

const results = await Promise.allSettled(checks.map(executeCheck));
const failures = results.filter((result) => result.status === "rejected");

for (const failure of failures) {
  console.error(`[SMOKE_FAIL] ${failure.reason instanceof Error ? failure.reason.message : failure.reason}`);
}

if (failures.length > 0) {
  console.error(`[SMOKE_FAILED] ${failures.length}/${checks.length} checks failed.`);
  process.exitCode = 1;
} else {
  console.log(`[SMOKE_PASSED] ${checks.length}/${checks.length} checks passed.`);
}
