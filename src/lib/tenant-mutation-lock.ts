import type { Prisma } from "@prisma/client";

export async function lockTenantMutation(
  tx: Prisma.TransactionClient,
  tenantId: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`;
}
