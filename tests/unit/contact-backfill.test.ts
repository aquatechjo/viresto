import { test, mock } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  databaseEndpointOf,
  planContactRow,
  summarizePlans,
  type BackfillCrypto,
  type ContactRow,
} from "@/lib/contact-backfill";

// scripts/backfill-search-hashes.ts: what each client row becomes, the
// report, and a dry run that never writes.

// Readable fakes: "enc:v2:<key>:<text>" with keys "old" and "new" (active).
const fake: BackfillCrypto = {
  decrypt: (value) => {
    const match = value.match(/^enc:v2:([^:]+):(.*)$/);
    if (!match) return value;
    if (match[1] !== "old" && match[1] !== "new") throw new Error(`key ${match[1]} unavailable`);
    return match[2];
  },
  encrypt: (value) => `enc:v2:new:${value}`,
  hash: (value) => `h(${value})`,
  keyIdOf: (value) => (value.startsWith("enc:v2:") ? value.split(":")[2] : null),
  activeKeyId: "new",
};

let nextId = 0;
function row(overrides: Partial<ContactRow>): ContactRow {
  nextId += 1;
  return {
    id: `c${nextId}`,
    publicId: nextId,
    tenantId: "t1",
    phone: "enc:v2:new:+962791234567",
    email: null,
    nationalId: "enc:v2:new:9991234567",
    address: null,
    notes: null,
    phoneHash: "h(+962791234567)",
    emailHash: null,
    nationalIdHash: "h(9991234567)",
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    ...overrides,
  };
}

test("a row already in the current form has nothing to write", () => {
  const plan = planContactRow(row({}), fake);
  assert.equal(plan.kind, "ok");
  assert.deepEqual(plan.kind === "ok" && plan.data, {});
});

test("an old phone form is re-encrypted in E.164 and re-hashed", () => {
  for (const old of ["0791234567", "+962 79 123 4567", "00962791234567", "962791234567"]) {
    const plan = planContactRow(
      row({ phone: `enc:v2:new:${old}`, phoneHash: `h(${old.replace(/[^\d+]/g, "")})` }),
      fake,
    );
    assert.equal(plan.kind, "ok");
    if (plan.kind !== "ok") continue;
    assert.equal(plan.data.phone, "enc:v2:new:+962791234567", old);
    assert.equal(plan.hashes.phone, "h(+962791234567)", old);
    // The old normalization already gave "+962791234567" for this one.
    assert.equal(plan.fields.phone.hashChanged, old !== "+962 79 123 4567", old);
    assert.equal(plan.fields.phone.reformatted, true);
  }
});

test("Saudi and Jordanian landline numbers normalize too", () => {
  const plan = planContactRow(
    row({ phone: "enc:v2:new:00966 50 123 4567", phoneHash: null }),
    fake,
  );
  assert.equal(plan.kind === "ok" && plan.data.phone, "enc:v2:new:+966501234567");
  const landline = planContactRow(row({ phone: "enc:v2:new:06 512 3456", phoneHash: null }), fake);
  assert.equal(landline.kind === "ok" && landline.data.phone, "enc:v2:new:+96265123456");
});

test("national ID and email: normalized, re-encrypted, re-hashed", () => {
  const plan = planContactRow(
    row({
      nationalId: "enc:v2:new:999 123 4567",
      nationalIdHash: "h(999 123 4567)",
      email: "enc:v2:new: Client@Example.COM ",
      emailHash: "h(client@example.com)",
    }),
    fake,
  );
  assert.equal(plan.kind, "ok");
  if (plan.kind !== "ok") return;
  assert.equal(plan.data.nationalId, "enc:v2:new:9991234567");
  assert.equal(plan.data.nationalIdHash, "h(9991234567)");
  assert.equal(plan.data.email, "enc:v2:new:client@example.com");
  assert.equal("emailHash" in plan.data, false, "same hash: not rewritten");
});

test("key rotation: values under an older key or in plain text get the active key", () => {
  const plan = planContactRow(
    row({
      phone: "enc:v2:old:+962791234567",
      address: "enc:v2:old:Amman",
      notes: "plain notes",
    }),
    fake,
  );
  assert.equal(plan.kind, "ok");
  if (plan.kind !== "ok") return;
  assert.equal(plan.data.phone, "enc:v2:new:+962791234567");
  assert.equal(plan.data.address, "enc:v2:new:Amman");
  assert.equal(plan.data.notes, "enc:v2:new:plain notes");
  assert.equal("phoneHash" in plan.data, false);
});

test("a new hash secret: every hash is rewritten", () => {
  const rotated = { ...fake, hash: (value: string) => `h2(${value})` };
  const plan = planContactRow(row({}), rotated);
  assert.equal(plan.kind === "ok" && plan.data.phoneHash, "h2(+962791234567)");
  assert.equal(plan.kind === "ok" && plan.data.nationalIdHash, "h2(9991234567)");
});

test("a value that does not normalize is kept and its hash cleared", () => {
  const plan = planContactRow(row({ phone: "enc:v2:new:079-12", phoneHash: "h(07912)" }), fake);
  assert.equal(plan.kind, "ok");
  if (plan.kind !== "ok") return;
  assert.equal("phone" in plan.data, false);
  assert.equal(plan.data.phoneHash, null);
  assert.equal(plan.fields.phone.invalid, true);
});

test("a row encrypted with a missing key is reported, not planned", () => {
  const plan = planContactRow(row({ phone: "enc:v2:lost:+962791234567" }), fake);
  assert.equal(plan.kind, "unreadable");
  assert.equal(plan.kind === "unreadable" && plan.field, "phone");
});

test("the summary counts each case and finds duplicates within an office", () => {
  const plans = [
    row({}),
    row({ phone: "enc:v2:new:0791234567", phoneHash: "h(0791234567)", nationalId: null, nationalIdHash: null }),
    row({ tenantId: "t2", phone: "enc:v2:new:0791234567", phoneHash: null, nationalId: null, nationalIdHash: null }),
    row({ phone: "enc:v2:lost:x" }),
    row({ phone: "enc:v2:new:12", phoneHash: "h(12)", nationalId: null, nationalIdHash: null }),
  ].map((r) => planContactRow(r, fake));
  const summary = summarizePlans(plans);

  assert.equal(summary.rows, 5);
  assert.equal(summary.unchanged, 1);
  assert.equal(summary.toUpdate, 3);
  assert.equal(summary.unreadable.length, 1);
  assert.equal(summary.perField.phone.reformatted, 2);
  assert.equal(summary.perField.phone.invalid, 1);
  // Rows 1 and 2 share the phone in office t1; office t2's copy is not a duplicate.
  assert.deepEqual(summary.collisions, [{ tenantId: "t1", field: "phone", publicIds: [plans[0].publicId, plans[1].publicId] }]);
});

test("the endpoint id is read from Neon URLs, pooled or not", () => {
  assert.equal(databaseEndpointOf("postgresql://u:p@ep-patient-cake-aqguafst-pooler.c-8.us-east-1.aws.neon.tech/db"), "ep-patient-cake-aqguafst");
  assert.equal(databaseEndpointOf("postgresql://u:p@ep-patient-cake-aqguafst.c-8.us-east-1.aws.neon.tech/db"), "ep-patient-cake-aqguafst");
  assert.equal(databaseEndpointOf("postgresql://u:p@localhost:5432/db"), "localhost");
  assert.equal(databaseEndpointOf(undefined), null);
});

test("the script's dry run reads every client and writes nothing", async () => {
  process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
  process.env.ENCRYPTION_KEY_ID = "test";
  process.env.ENCRYPTION_PREVIOUS_KEYS = "";
  process.env.SEARCH_HASH_SECRET = "test-search-hash-secret";
  process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";

  const { encryptText } = await import("@/lib/encryption");
  const rows = [
    row({ phone: encryptText("0791234567")!, nationalId: encryptText("9991234567")! }),
    row({ phone: encryptText("+966501234567")!, nationalId: null, nationalIdHash: null }),
  ];
  const writes: string[] = [];
  let done!: () => void;
  const finished = new Promise<void>((resolve) => (done = resolve));

  class FakePrisma {
    client = {
      findMany: async (args: { cursor?: unknown }) => (args.cursor ? [] : rows),
      updateMany: async () => {
        writes.push("updateMany");
        return { count: 1 };
      },
      update: async () => writes.push("update"),
    };
    $transaction = async () => writes.push("$transaction");
    $executeRaw = async () => writes.push("$executeRaw");
    $disconnect = async () => done();
  }
  mock.module("@prisma/client", { namedExports: { PrismaClient: FakePrisma } });

  const logs: string[] = [];
  const log = mock.method(console, "log", (...parts: unknown[]) => logs.push(parts.join(" ")));
  process.argv = [process.argv[0], "backfill-search-hashes.ts"];
  await import("../../scripts/backfill-search-hashes");
  await finished;
  log.mock.restore();

  assert.deepEqual(writes, []);
  const output = logs.join("\n");
  assert.match(output, /DRY RUN/);
  assert.match(output, /Clients read: 2/);
  assert.match(output, /Dry run: nothing written\./);
  // Counts and ids only: no decrypted value is printed.
  assert.doesNotMatch(output, /0791234567|966501234567|9991234567/);
});
