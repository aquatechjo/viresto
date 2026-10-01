import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import {
  dropIntegrationSchema,
  setupIntegrationDatabase,
  type IntegrationDatabase,
} from "./helpers/database";
import { TEST_PRODUCTS } from "./helpers/polar";
import { TEST_PASSWORD, apiRequest, createOfficeTools } from "./helpers/offices";

// AUDIT_REPORT.md M4, follow-up: a locked office's ADMIN can list and
// download the office's document files. Real Postgres and route handlers;
// Cloudinary (the private file store) and email are faked.

const verificationCodes = new Map<string, string>();
const fetchedAssets: string[] = [];

mock.module("@/lib/email", {
  namedExports: {
    sendVerificationEmail: async ({ to, code }: { to: string; code: string }) => {
      verificationCodes.set(to, code);
      return { skipped: true };
    },
  },
});

mock.module("@/lib/cloudinary", {
  defaultExport: {},
  namedExports: {
    isTenantCloudinaryAsset: (publicId: string, tenantId: string) =>
      publicId.startsWith(`Viresto/${tenantId}/`),
    fetchAuthenticatedCloudinaryAsset: async ({ publicId }: { publicId: string }) => {
      fetchedAssets.push(publicId);
      return new Response(`file:${publicId}`, { headers: { "content-type": "application/pdf" } });
    },
    streamPrivateAsset: (
      upstream: Response,
      options: { fileName: string; disposition: "inline" | "attachment" },
    ) =>
      new Response(upstream.body, {
        headers: {
          "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
          "content-disposition": `${options.disposition}; filename="${options.fileName}"`,
        },
      }),
  },
});

const DAY_MS = 24 * 60 * 60 * 1000;

type Handler = (req: NextRequest) => Promise<Response>;
type DocumentHandler = (req: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>;

let database: IntegrationDatabase;
let prisma: typeof import("../../src/lib/prisma")["prisma"];
let tools: ReturnType<typeof createOfficeTools>;
let listGET: Handler;
let fileGET: DocumentHandler;
let clientsGET: Handler;
let limits: typeof import("../../src/lib/expensive-route-limits");
let checkRateLimit: typeof import("../../src/lib/rate-limit")["checkRateLimit"];

before(async () => {
  database = setupIntegrationDatabase();

  ({ prisma } = await import("../../src/lib/prisma"));
  ({ GET: listGET } = await import("../../src/app/api/data-requests/documents/route"));
  ({ GET: fileGET } = await import("../../src/app/api/data-requests/documents/[id]/route"));
  ({ GET: clientsGET } = await import("../../src/app/api/clients/route"));
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

async function lockOffice(tenantId: string) {
  const past = new Date(Date.now() - DAY_MS);
  await prisma.subscription.updateMany({
    where: { tenantId, polarSubscriptionId: null },
    data: { trialStartsAt: new Date(past.getTime() - 14 * DAY_MS), trialEndsAt: past, currentPeriodEnd: past },
  });
}

async function addDocument(tenantId: string, fileName: string, publicId = `Viresto/${tenantId}/documents/${fileName}`) {
  return prisma.document.create({
    data: { tenantId, fileName, fileType: "application/pdf", fileUrl: "https://example.invalid", publicId, fileSize: 10 },
  });
}

function download(cookie: string, id: string) {
  return fileGET(apiRequest("GET", `/api/data-requests/documents/${id}`, cookie), {
    params: Promise.resolve({ id }),
  });
}

test("a locked office's ADMIN lists and downloads its document files", async () => {
  const office = await tools.registerOffice("doc-export");
  const other = await tools.registerOffice("doc-export-other");
  const first = await addDocument(office.tenantId, "contract.pdf");
  const second = await addDocument(office.tenantId, "judgment.pdf");
  const foreign = await addDocument(other.tenantId, "foreign.pdf");
  await lockOffice(office.tenantId);
  assert.equal((await clientsGET(apiRequest("GET", "/api/clients", office.cookie))).status, 402, "office is locked");

  const listed = await listGET(apiRequest("GET", "/api/data-requests/documents", office.cookie));
  assert.equal(listed.status, 200, await listed.clone().text());
  const list = (await listed.json()).data;
  assert.deepEqual(
    list.documents.map((doc: { id: string }) => doc.id).sort(),
    [first.id, second.id].sort(),
  );
  assert.equal(list.nextCursor, null);
  assert.ok(!JSON.stringify(list).includes("Viresto/"), "storage path not exposed");

  const response = await download(office.cookie, first.id);
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(await response.text(), `file:${first.publicId}`);
  assert.match(response.headers.get("content-disposition") ?? "", /^attachment; filename="contract.pdf"/);

  const logged = await prisma.activity.findMany({
    where: { tenantId: office.tenantId, type: "DOCUMENT_FILE_EXPORTED" },
  });
  assert.equal(logged.length, 1);
  assert.equal(logged[0].actorId, office.userId);
  assert.equal(logged[0].entityId, first.id);

  // Another office's document: not found, and its file is never fetched.
  const before = fetchedAssets.length;
  assert.equal((await download(office.cookie, foreign.id)).status, 404);
  assert.equal(fetchedAssets.length, before);
});

test("only an ADMIN, only its own storage path, and rate limited", async () => {
  const office = await tools.registerOffice("doc-export-rules");
  const doc = await addDocument(office.tenantId, "a.pdf");
  const misplaced = await addDocument(office.tenantId, "b.pdf", "Viresto/someone-else/documents/b.pdf");
  await lockOffice(office.tenantId);

  const lawyerEmail = `it-doc-lawyer-${Date.now()}@example.com`;
  await prisma.user.create({
    data: {
      tenantId: office.tenantId,
      name: "Lawyer",
      email: lawyerEmail,
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 12),
      role: "LAWYER",
      emailVerifiedAt: new Date(),
    },
  });
  const lawyer = await tools.login(lawyerEmail);
  assert.equal((await listGET(apiRequest("GET", "/api/data-requests/documents", lawyer))).status, 403);
  assert.equal((await download(lawyer, doc.id)).status, 403);

  assert.equal((await download(office.cookie, misplaced.id)).status, 403);

  for (let i = 0; i < limits.DOCUMENT_FILE_EXPORT_RATE_LIMIT.max - 1; i++) {
    assert.ok((await checkRateLimit(office.tenantId, limits.DOCUMENT_FILE_EXPORT_RATE_LIMIT)).allowed);
  }
  assert.equal((await download(office.cookie, doc.id)).status, 200);
  assert.equal((await download(office.cookie, doc.id)).status, 429);
});
