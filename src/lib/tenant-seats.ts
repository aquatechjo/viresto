import { prisma } from "@/lib/prisma";
import { getTenantBillingLimits } from "@/lib/billing-limits";

// Plan seat limits after a downgrade (or trial → a smaller paid plan).
// Nobody is deactivated automatically: when an office has more active
// users than its plan allows, the users beyond the limit become read-only
// until the office admin deactivates members or upgrades. Seats go, in
// order, to:
//   1. the owner: the office's earliest-created active user (who registered it),
//   2. the other active ADMINs, oldest first,
//   3. everyone else, oldest first.
// The owner always keeps a seat, so an admin can always fix the office.

export const SEAT_LIMIT_READ_ONLY_CODE = "SEAT_LIMIT_READ_ONLY";

export const SEAT_LIMIT_READ_ONLY_MESSAGE =
  "حسابك للقراءة فقط: عدد المستخدمين الفعّالين في المكتب أكبر من حد خطته. اطلب من مدير المكتب تعطيل بعض المستخدمين أو ترقية الخطة.";

export type SeatCandidate = {
  id: string;
  name: string;
  role: string;
  createdAt: Date;
};

export type TenantSeatState = {
  limit: number | null;
  planName: string;
  activeCount: number;
  ownerId: string | null;
  readOnlyUsers: Array<{ id: string; name: string }>;
};

function byJoinDate(a: SeatCandidate, b: SeatCandidate) {
  return a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);
}

/** Pure: which active users keep a seat under `limit` (null = unlimited). */
export function allocateSeats(
  activeUsers: SeatCandidate[],
  limit: number | null,
): Pick<TenantSeatState, "activeCount" | "ownerId" | "readOnlyUsers"> {
  const ordered = [...activeUsers].sort(byJoinDate);
  const [owner, ...rest] = ordered;
  const seatOrder = owner
    ? [
        owner,
        ...rest.filter((user) => user.role === "ADMIN"),
        ...rest.filter((user) => user.role !== "ADMIN"),
      ]
    : [];

  const seats = limit === null ? seatOrder.length : Math.max(1, limit);

  return {
    activeCount: ordered.length,
    ownerId: owner?.id ?? null,
    readOnlyUsers: seatOrder
      .slice(seats)
      .map((user) => ({ id: user.id, name: user.name })),
  };
}

export async function getTenantSeatState(tenantId: string): Promise<TenantSeatState> {
  const [billing, activeUsers] = await Promise.all([
    getTenantBillingLimits(tenantId),
    prisma.user.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, role: true, createdAt: true },
    }),
  ]);

  const limit = billing.subscriptionId ? billing.limits.users : null;

  return {
    limit,
    planName: billing.plan.name,
    ...allocateSeats(activeUsers, limit),
  };
}

// Same short window as the auth and tenant-access caches: absorbs the
// burst of writes in one page load. Team changes and billing syncs
// invalidate it explicitly.
const SEAT_CACHE_TTL_MS = Number(process.env.AUTH_CACHE_TTL_MS || 5_000);

type SeatCacheEntry = { expiresAt: number; state: TenantSeatState };

type GlobalWithSeatCache = typeof globalThis & {
  __virestoTenantSeatCache?: Map<string, SeatCacheEntry>;
};

const seatCache = ((globalThis as GlobalWithSeatCache).__virestoTenantSeatCache ??=
  new Map<string, SeatCacheEntry>());

export async function getTenantSeatStateCached(
  tenantId: string,
): Promise<TenantSeatState> {
  const now = Date.now();
  const cached = seatCache.get(tenantId);

  if (cached && cached.expiresAt > now) return cached.state;

  const state = await getTenantSeatState(tenantId);

  if (SEAT_CACHE_TTL_MS > 0) {
    seatCache.set(tenantId, { state, expiresAt: now + SEAT_CACHE_TTL_MS });
  }

  return state;
}

export function invalidateTenantSeatCache(tenantId: string) {
  seatCache.delete(tenantId);
}

export function isReadOnlySeat(state: TenantSeatState, userId: string) {
  return state.readOnlyUsers.some((user) => user.id === userId);
}
