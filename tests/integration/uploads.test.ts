import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { v2 as realCloudinary } from "cloudinary";
import { NextRequest } from "next/server";
import {
  dropIntegrationSchema,
  setupIntegrationDatabase,
  type IntegrationDatabase,
} from "./helpers/database";
import { TEST_PRODUCTS } from "./helpers/polar";
import { ORIGIN, apiRequest, createOfficeTools } from "./helpers/offices";

// AUDIT_REPORT.md M7: direct-to-Cloudinary uploads.
// - The upload signature binds allowed_formats, so Cloudinary itself
//   rejects other file types.
// - Uploads never finalized (no Document row) are deleted after 24h by the
//   daily prune cron.
// Real Postgres and route handlers. Cloudinary's Admin API is faked (its
// real signing utilities are used); email is mocked for registration.

const verificationCodes = new Map<string, string>();

mock.module("@/lib/email", {
  namedExports: {
    sendVerificationEmail: async ({ to, code }: { to: string; code: string }) => {
      verificationCodes.set(to, code);
      return { skipped: true };
    },
  },
});

type FakeAsset = { public_id: string; resource_type: "image" | "raw"; created_at: string };
const cloudAssets: FakeAsset[] = [];
const deletedAssets: Array<{ id: string; resourceType: string }> = [];

const fakeCloudinary = {
  config: () => undefined,
  utils: realCloudinary.utils,
  url: () => "https://res.cloudinary.com/it-cloud/fake",
  uploader: { destroy: async () => ({ result: "ok" }) },
  api: {
    async resources(options: { type: string; resource_type: string; prefix: string }) {
      assert.equal(options.type, "authenticated");
      return {
        resources: cloudAssets.filter(
          (asset) =>
            asset.resource_type === options.resource_type &&
            asset.public_id.startsWith(options.prefix),
        ),
      };
    },
    async delete_resources(ids: string[], options: { type: string; resource_type: string }) {
      assert.equal(options.type, "authenticated");
      for (const id of ids) deletedAssets.push({ id, resourceType: options.resource_type });
      return { deleted: Object.fromEntries(ids.map((id) => [id, "deleted"])) };
    },
  },
};

mock.module("@/lib/cloudinary", {
  defaultExport: fakeCloudinary,
  namedExports: {
    generateSignedFileUrl: () => "https://res.cloudinary.com/it-cloud/fake",
    generatePrivateDownloadUrl: () => "https://res.cloudinary.com/it-cloud/fake",
    isTenantCloudinaryAsset: () => true,
    fetchAuthenticatedCloudinaryAsset: async () => null,
    streamPrivateAsset: () => new Response(null),
  },
});

const CRON_SECRET = "integration-cron-secret-000000000000002";
const CLOUD_SECRET = "integration-cloudinary-secret";

let database: IntegrationDatabase;
let prisma: typeof import("../../src/lib/prisma")["prisma"];
let tools: ReturnType<typeof createOfficeTools>;
let signPOST: (req: NextRequest) => Promise<Response>;
let pruneGET: (req: NextRequest) => Promise<Response>;

before(async () => {
  database = setupIntegrationDatabase();
  Object.assign(process.env, {
    CRON_SECRET,
    CLOUDINARY_CLOUD_NAME: "it-cloud",
    CLOUDINARY_API_KEY: "it-key",
    CLOUDINARY_API_SECRET: CLOUD_SECRET,
  });

  ({ prisma } = await import("../../src/lib/prisma"));
  ({ POST: signPOST } = await import("../../src/app/api/upload/sign/route"));
  ({ GET: pruneGET } = await import("../../src/app/api/cron/prune-activity/route"));

  tools = createOfficeTools({
    prisma,
    registerPOST: (await import("../../src/app/api/auth/register/route")).POST,
    verifyEmailPOST: (await import("../../src/app/api/auth/verify-email/route")).POST,
    loginPOST: (await import("../../src/app/api/auth/login/route")).POST,
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

test("upload signature binds the allowed file formats", async () => {
  const office = await tools.registerOffice("upload-sign");
  const client = await prisma.client.create({ data: { tenantId: office.tenantId, name: "C" } });
  const legalCase = await prisma.case.create({
    data: { tenantId: office.tenantId, clientId: client.id, leadLawyerId: office.userId, title: "Case" },
  });

  const response = await signPOST(
    apiRequest("POST", "/api/upload/sign", office.cookie, {
      caseId: legalCase.id,
      fileName: "contract.pdf",
      mimeType: "application/pdf",
      fileSize: 2048,
    }),
  );
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));

  const signed = body.data;
  assert.equal(signed.allowedFormats, "pdf,png,jpg,jpeg,webp,docx");

  // The signature must cover allowed_formats, so the browser cannot drop or
  // widen it: Cloudinary recomputes it from the submitted fields.
  const expected = realCloudinary.utils.api_sign_request(
    {
      allowed_formats: signed.allowedFormats,
      folder: signed.folder,
      overwrite: false,
      public_id: signed.publicId,
      timestamp: signed.timestamp,
      type: signed.type,
    },
    CLOUD_SECRET,
  );
  assert.equal(signed.signature, expected);
});

test("prune deletes uploads never finalized after 24h, and nothing else", async () => {
  const office = await tools.registerOffice("upload-cleanup");
  const t = office.tenantId;
  const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
  const dir = `Viresto/${t}/documents`;

  const client = await prisma.client.create({ data: { tenantId: t, name: "C" } });
  const legalCase = await prisma.case.create({
    data: { tenantId: t, clientId: client.id, leadLawyerId: office.userId, title: "Case" },
  });
  for (const publicId of [`${dir}/finalized-pdf`, `${dir}/finalized-docx`]) {
    await prisma.document.create({
      data: {
        tenantId: t,
        caseId: legalCase.id,
        fileName: "f",
        fileType: "application/pdf",
        fileUrl: "https://res.cloudinary.com/it-cloud/f",
        publicId,
      },
    });
  }

  cloudAssets.push(
    { public_id: `${dir}/orphan-old`, resource_type: "image", created_at: hoursAgo(30) },
    { public_id: `${dir}/orphan-old-raw.docx`, resource_type: "raw", created_at: hoursAgo(48) },
    { public_id: `${dir}/orphan-recent`, resource_type: "image", created_at: hoursAgo(2) },
    { public_id: `${dir}/finalized-pdf`, resource_type: "image", created_at: hoursAgo(100) },
    // Raw assets can carry the extension in Cloudinary but not in our row.
    { public_id: `${dir}/finalized-docx.docx`, resource_type: "raw", created_at: hoursAgo(100) },
    // Outside the documents folder: never touched.
    { public_id: `Viresto/${t}/branding/logo`, resource_type: "image", created_at: hoursAgo(100) },
  );

  const response = await pruneGET(
    new NextRequest(`${ORIGIN}/api/cron/prune-activity`, {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    }),
  );
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));

  assert.deepEqual(
    deletedAssets.sort((a, b) => a.id.localeCompare(b.id)),
    [
      { id: `${dir}/orphan-old`, resourceType: "image" },
      { id: `${dir}/orphan-old-raw.docx`, resourceType: "raw" },
    ],
  );
  assert.equal(body.data.uploads.deleted, 2);
});
