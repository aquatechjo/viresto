import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  dropIntegrationSchema,
  setupIntegrationDatabase,
  type IntegrationDatabase,
} from "./helpers/database";
import { TEST_PRODUCTS } from "./helpers/polar";
import { apiRequest, createOfficeTools } from "./helpers/offices";

// AUDIT_REPORT.md L9: per-user limits on the expensive authenticated
// routes, search and AI document summaries. Real Postgres and route
// handlers; the limiter uses its in-process store (no Upstash in tests).

const verificationCodes = new Map<string, string>();

mock.module("@/lib/email", {
  namedExports: {
    sendVerificationEmail: async ({ to, code }: { to: string; code: string }) => {
      verificationCodes.set(to, code);
      return { skipped: true };
    },
  },
});

type Handler = (req: NextRequest) => Promise<Response>;
type DocumentHandler = (req: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>;

let database: IntegrationDatabase;
let prisma: typeof import("../../src/lib/prisma")["prisma"];
let tools: ReturnType<typeof createOfficeTools>;
let searchGET: Handler;
let summarizePOST: DocumentHandler;
let limits: typeof import("../../src/lib/expensive-route-limits");
let checkRateLimit: typeof import("../../src/lib/rate-limit")["checkRateLimit"];

before(async () => {
  database = setupIntegrationDatabase();

  ({ prisma } = await import("../../src/lib/prisma"));
  ({ GET: searchGET } = await import("../../src/app/api/search/route"));
  ({ POST: summarizePOST } = await import("../../src/app/api/documents/[id]/summarize/route"));
  limits = await import("../../src/lib/expensive-route-limits");
  ({ checkRateLimit } = await import("../../src/lib/rate-limit"));
  const post = async (name: string) => (await import(`../../src/app/api/auth/${name}/route`)).POST;

  tools = createOfficeTools({
    prisma,
    registerPOST: await post("register"),
    verifyEmailPOST: await post("verify-email"),
    loginPOST: await post("login"),
    verificationCodes,
  });

  await prisma.billingPlan.createMany({
    data: (["BASIC", "PRO", "BUSINESS"] as const).map((code, index) => ({
      code,
      name: code,
      currency: "USD",
      sortOrder: index,
      polarMonthlyProductId: TEST_PRODUCTS[code].monthly,
      polarYearlyProductId: TEST_PRODUCTS[code].yearly,
    })),
  });
});

after(async () => {
  if (prisma && database) await dropIntegrationSchema(prisma, database.schema);
});

test("search is limited per user", async () => {
  const office = await tools.registerOffice("search-limit");
  const colleague = await tools.login(office.email);
  const other = await tools.registerOffice("search-limit-other");
  const search = (cookie: string) => searchGET(apiRequest("GET", "/api/search?q=ab", cookie));

  // A minute is shorter than max round trips to the dev database, so use up
  // all but one of this user's searches directly, then go through the route.
  // Each request comes from a new IP (apiRequest), so the limit is per user.
  for (let i = 0; i < limits.SEARCH_RATE_LIMIT.max - 1; i++) {
    assert.ok((await checkRateLimit(office.userId, limits.SEARCH_RATE_LIMIT)).allowed);
  }

  const last = await search(office.cookie);
  assert.equal(last.status, 200, await last.clone().text());

  const limited = await search(office.cookie);
  assert.equal(limited.status, 429);
  // The same user on another session is the same user.
  assert.equal((await search(colleague)).status, 429);
  assert.equal((await search(other.cookie)).status, 200);
});

test("AI document summaries are limited per user", async () => {
  const office = await tools.registerOffice("summary-limit");
  const other = await tools.registerOffice("summary-limit-other");
  const summarize = (cookie: string) =>
    summarizePOST(apiRequest("POST", "/api/documents/missing/summarize", cookie, {}), {
      params: Promise.resolve({ id: "missing" }),
    });

  for (let i = 0; i < limits.SUMMARIZE_RATE_LIMIT.max; i++) {
    const response = await summarize(office.cookie);
    assert.notEqual(response.status, 429, `request ${i + 1} limited too early`);
  }

  assert.equal((await summarize(office.cookie)).status, 429);
  assert.notEqual((await summarize(other.cookie)).status, 429);
});
