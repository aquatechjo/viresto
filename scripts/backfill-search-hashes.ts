/**
 * One-off: bring every client's contact fields in line with today's rules.
 *
 * For each client it decrypts phone, email and national ID, normalizes them
 * (phone E.164, national ID Latin digits, email lower case:
 * src/lib/contact-backfill.ts), and writes back:
 *   - the field, re-encrypted, when its normalized form differs;
 *   - every encrypted field (address and notes too) not encrypted with the
 *     active key (ENCRYPTION_KEY_ID) or still in plain text;
 *   - phoneHash, emailHash, nationalIdHash recomputed with the current
 *     SEARCH_HASH_SECRET.
 * A value that does not normalize (an old malformed phone) is kept as it is
 * and its hash cleared, like the app does on save; it is counted as invalid.
 *
 * Meant to run ONCE, in the key rotation session, with the new keys active
 * and the old ones in ENCRYPTION_PREVIOUS_KEYS. Deploy the code that
 * normalizes on save and search first.
 *
 *   npx tsx --env-file=<env file> scripts/backfill-search-hashes.ts
 *       dry run (default): reads only, prints counts
 *   npx tsx --env-file=<env file> scripts/backfill-search-hashes.ts --apply --endpoint=ep-...
 *       writes; --endpoint must name the database in DATABASE_URL
 *
 * --apply also refuses when a row cannot be decrypted (a missing key) or
 * when two clients of one office would share a phone, email or national ID,
 * unless --skip-unreadable / --allow-collisions say otherwise.
 *
 * Writes are per batch, in a transaction, and only where updatedAt has not
 * moved since the read (a client edited meanwhile is skipped and counted);
 * updatedAt itself is kept, so lists keep their order. Never deletes.
 * Prints counts and client publicIds only, never a decrypted value. Safe to
 * re-run: a row already right has nothing to write.
 */
import { PrismaClient } from "@prisma/client";
import {
  activeEncryptionKeyId,
  decryptText,
  encryptText,
  encryptionKeyIdOf,
  hashSearchValue,
} from "../src/lib/encryption";
import {
  databaseEndpointOf,
  planContactRow,
  summarizePlans,
  type BackfillCrypto,
  type RowPlan,
} from "../src/lib/contact-backfill";

const BATCH = 200;
const LIST_MAX = 20;

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const allowCollisions = args.includes("--allow-collisions");
const skipUnreadable = args.includes("--skip-unreadable");
const endpointArg = args.find((arg) => arg.startsWith("--endpoint="))?.slice("--endpoint=".length);

const prisma = new PrismaClient();

const crypto: BackfillCrypto = {
  decrypt: (value) => decryptText(value) ?? "",
  encrypt: (value) => encryptText(value) ?? value,
  hash: (value) => hashSearchValue(value)!,
  keyIdOf: encryptionKeyIdOf,
  activeKeyId: activeEncryptionKeyId(),
};

const select = {
  id: true,
  publicId: true,
  tenantId: true,
  phone: true,
  email: true,
  nationalId: true,
  address: true,
  notes: true,
  phoneHash: true,
  emailHash: true,
  nationalIdHash: true,
  updatedAt: true,
} as const;

async function readPlans() {
  const plans: RowPlan[] = [];
  let cursor: string | undefined;

  for (;;) {
    const rows = await prisma.client.findMany({
      select,
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (rows.length === 0) break;
    for (const row of rows) plans.push(planContactRow(row, crypto));
    cursor = rows[rows.length - 1].id;
  }

  return plans;
}

function list(values: Array<string | number>) {
  const shown = values.slice(0, LIST_MAX).join(", ");
  return values.length > LIST_MAX ? `${shown}, ... (+${values.length - LIST_MAX})` : shown;
}

async function main() {
  const endpoint = databaseEndpointOf(process.env.DATABASE_URL);
  console.log(`Mode: ${apply ? "APPLY (writes)" : "DRY RUN (no writes)"}`);
  console.log(`Database endpoint: ${endpoint ?? "(unparseable DATABASE_URL)"}`);
  console.log(`Active encryption key id: ${crypto.activeKeyId}\n`);

  if (apply && (!endpoint || endpointArg !== endpoint)) {
    throw new Error(
      `--apply needs --endpoint=<the endpoint id of DATABASE_URL> (${endpoint ?? "unknown"}), typed out, to be sure of the target.`,
    );
  }

  const plans = await readPlans();
  const summary = summarizePlans(plans);

  console.log(`Clients read: ${summary.rows}`);
  console.log(`  already right: ${summary.unchanged}`);
  console.log(`  to update:     ${summary.toUpdate}`);
  console.log(`  unreadable:    ${summary.unreadable.length}`);
  for (const [field, counts] of Object.entries(summary.perField)) {
    console.log(
      `  ${field.padEnd(10)} new form ${counts.reformatted}, re-encrypted ${counts.reencrypted}, ` +
        `hash changed ${counts.hashChanged}, invalid (kept, hash cleared) ${counts.invalid}`,
    );
  }

  if (summary.unreadable.length > 0) {
    console.log("\nUnreadable (field: error, publicIds):");
    const byReason = new Map<string, number[]>();
    for (const item of summary.unreadable) {
      const key = `${item.field}: ${item.error}`;
      byReason.set(key, [...(byReason.get(key) ?? []), item.publicId]);
    }
    for (const [reason, ids] of byReason) console.log(`  ${reason} -> ${list(ids)}`);
  }

  if (summary.collisions.length > 0) {
    console.log("\nSame value within one office after normalization (field, tenantId, publicIds):");
    for (const group of summary.collisions.slice(0, LIST_MAX)) {
      console.log(`  ${group.field} ${group.tenantId}: ${list(group.publicIds)}`);
    }
    if (summary.collisions.length > LIST_MAX) {
      console.log(`  ... (+${summary.collisions.length - LIST_MAX} groups)`);
    }
  }

  const invalidIds = plans
    .filter((plan) => plan.kind === "ok" && Object.values(plan.fields).some((f) => f.invalid))
    .map((plan) => plan.publicId);
  if (invalidIds.length > 0) {
    console.log(`\nClients with a value that does not normalize (fix by hand): ${list(invalidIds)}`);
  }

  if (!apply) {
    console.log("\nDry run: nothing written.");
    return;
  }

  if (summary.unreadable.length > 0 && !skipUnreadable) {
    throw new Error("Unreadable rows: fix the keys, or pass --skip-unreadable to leave them as they are.");
  }
  if (summary.collisions.length > 0 && !allowCollisions) {
    throw new Error("Duplicates after normalization: review them, then pass --allow-collisions.");
  }

  const updates = plans.filter(
    (plan): plan is Extract<RowPlan, { kind: "ok" }> =>
      plan.kind === "ok" && Object.keys(plan.data).length > 0,
  );
  let written = 0;
  const movedMeanwhile: number[] = [];

  for (let start = 0; start < updates.length; start += BATCH) {
    const batch = updates.slice(start, start + BATCH);
    const results = await prisma.$transaction(
      batch.map((plan) =>
        prisma.client.updateMany({
          where: { id: plan.id, updatedAt: plan.updatedAt },
          // updatedAt written back as it was: a data fix, not an edit.
          data: { ...plan.data, updatedAt: plan.updatedAt },
        }),
      ),
    );
    results.forEach((result, index) => {
      if (result.count === 1) written += 1;
      else movedMeanwhile.push(batch[index].publicId);
    });
    console.log(`  batch ${start / BATCH + 1}: ${results.filter((r) => r.count === 1).length}/${batch.length}`);
  }

  console.log(`\nWritten: ${written}`);
  if (movedMeanwhile.length > 0) {
    console.log(`Edited during the run, skipped (run again): ${list(movedMeanwhile)}`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
