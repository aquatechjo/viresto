import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveTenantAccess, type TenantAccess } from "@/lib/tenant-access";

type AccessReadClient = Pick<Prisma.TransactionClient, "subscription">;

// Same short window as the auth cache (api-auth.ts): absorbs the burst of
// API calls in one page load. The Polar sync and the checkout-return sync
// invalidate it explicitly, so a payment unlocks on the next request on
// the instance that handled it (other warm instances within this TTL).
const ACCESS_CACHE_TTL_MS = Number(process.env.AUTH_CACHE_TTL_MS || 5_000);

type GlobalWithAccessCache = typeof globalThis & {
  __virestoTenantAccessCache?: Map<
    string,
    { expiresAt: number; access: TenantAccess }
  >;
};

const accessCache =
  ((globalThis as GlobalWithAccessCache).__virestoTenantAccessCache ??=
    new Map());

export const ACCESS_SUBSCRIPTION_SELECT = {
  id: true,
  status: true,
  polarSubscriptionId: true,
  trialStartsAt: true,
  trialEndsAt: true,
  currentPeriodEnd: true,
  cancelAtPeriodEnd: true,
  createdAt: true,
} as const;

export async function getTenantAccess(
  tenantId: string,
  db: AccessReadClient = prisma,
): Promise<TenantAccess> {
  const subscriptions = await db.subscription.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: ACCESS_SUBSCRIPTION_SELECT,
  });

  return resolveTenantAccess(subscriptions);
}

export async function getTenantAccessCached(tenantId: string) {
  const now = Date.now();
  const cached = accessCache.get(tenantId);

  if (cached && cached.expiresAt > now) {
    return cached.access;
  }

  const access = await getTenantAccess(tenantId);

  if (ACCESS_CACHE_TTL_MS > 0) {
    accessCache.set(tenantId, {
      access,
      expiresAt: now + ACCESS_CACHE_TTL_MS,
    });
  }

  return access;
}

export function invalidateTenantAccessCache(tenantId: string) {
  accessCache.delete(tenantId);
}
