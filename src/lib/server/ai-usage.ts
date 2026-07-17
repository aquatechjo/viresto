import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { lockTenantMutation } from "@/lib/tenant-mutation-lock";
import {
  getAiUsagePeriod,
  normalizeActualTokenUsage,
} from "@/lib/ai-usage-core";

const RESERVATION_TTL_MS = 10 * 60 * 1000;

type UsageSnapshot = {
  limitTokens: number;
  usedTokens: number;
  reservedTokens: number;
  remainingTokens: number;
  periodStart: Date;
  periodEnd: Date;
};

function usageSnapshot(input: {
  limitTokens: number;
  usedTokens: number;
  reservedTokens: number;
  periodStart: Date;
  periodEnd: Date;
}): UsageSnapshot {
  return {
    ...input,
    remainingTokens: Math.max(
      input.limitTokens - input.usedTokens - input.reservedTokens,
      0,
    ),
  };
}

export async function reserveAiUsage(input: {
  tenantId: string;
  limitTokens: number;
  requestedTokens: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const period = getAiUsagePeriod(now);

  if (
    !Number.isSafeInteger(input.limitTokens) ||
    input.limitTokens <= 0 ||
    !Number.isSafeInteger(input.requestedTokens) ||
    input.requestedTokens <= 0
  ) {
    return {
      ok: false as const,
      usage: usageSnapshot({
        limitTokens: Math.max(input.limitTokens, 0),
        usedTokens: 0,
        reservedTokens: 0,
        periodStart: period.start,
        periodEnd: period.end,
      }),
    };
  }

  return prisma.$transaction(async (tx) => {
    await lockTenantMutation(tx, input.tenantId);

    let usagePeriod = await tx.aiUsagePeriod.upsert({
      where: {
        tenantId_periodStart: {
          tenantId: input.tenantId,
          periodStart: period.start,
        },
      },
      create: {
        tenantId: input.tenantId,
        periodStart: period.start,
      },
      update: {},
    });

    const expiredReservations = await tx.aiUsageReservation.findMany({
      where: {
        usagePeriodId: usagePeriod.id,
        status: "PENDING",
        expiresAt: { lte: now },
      },
      select: {
        id: true,
        reservedTokens: true,
      },
    });

    if (expiredReservations.length > 0) {
      const expiredTokens = expiredReservations.reduce(
        (total, reservation) => total + reservation.reservedTokens,
        0,
      );

      await tx.aiUsageReservation.updateMany({
        where: {
          id: { in: expiredReservations.map((item) => item.id) },
          status: "PENDING",
        },
        data: {
          status: "EXPIRED",
        },
      });

      usagePeriod = await tx.aiUsagePeriod.update({
        where: { id: usagePeriod.id },
        data: {
          usedTokens: usagePeriod.usedTokens + expiredTokens,
          reservedTokens: Math.max(
            usagePeriod.reservedTokens - expiredTokens,
            0,
          ),
        },
      });
    }

    const currentUsage = usageSnapshot({
      limitTokens: input.limitTokens,
      usedTokens: usagePeriod.usedTokens,
      reservedTokens: usagePeriod.reservedTokens,
      periodStart: period.start,
      periodEnd: period.end,
    });

    if (input.requestedTokens > currentUsage.remainingTokens) {
      return {
        ok: false as const,
        usage: currentUsage,
      };
    }

    const reservationId = randomUUID();

    await tx.aiUsageReservation.create({
      data: {
        id: reservationId,
        usagePeriodId: usagePeriod.id,
        reservedTokens: input.requestedTokens,
        expiresAt: new Date(now.getTime() + RESERVATION_TTL_MS),
      },
    });

    const updatedPeriod = await tx.aiUsagePeriod.update({
      where: { id: usagePeriod.id },
      data: {
        reservedTokens: {
          increment: input.requestedTokens,
        },
      },
    });

    return {
      ok: true as const,
      reservation: {
        id: reservationId,
        reservedTokens: input.requestedTokens,
      },
      usage: usageSnapshot({
        limitTokens: input.limitTokens,
        usedTokens: updatedPeriod.usedTokens,
        reservedTokens: updatedPeriod.reservedTokens,
        periodStart: period.start,
        periodEnd: period.end,
      }),
    };
  });
}

export async function commitAiUsage(input: {
  tenantId: string;
  reservationId: string;
  limitTokens: number;
  actualTokens?: number | null;
}) {
  return prisma.$transaction(async (tx) => {
    await lockTenantMutation(tx, input.tenantId);

    const reservation = await tx.aiUsageReservation.findUnique({
      where: { id: input.reservationId },
      include: { usagePeriod: true },
    });

    if (!reservation || reservation.usagePeriod.tenantId !== input.tenantId) {
      throw new Error("AI_USAGE_RESERVATION_NOT_FOUND");
    }

    const period = getAiUsagePeriod(reservation.usagePeriod.periodStart);

    if (reservation.status !== "PENDING") {
      return usageSnapshot({
        limitTokens: input.limitTokens,
        usedTokens: reservation.usagePeriod.usedTokens,
        reservedTokens: reservation.usagePeriod.reservedTokens,
        periodStart: period.start,
        periodEnd: period.end,
      });
    }

    const actualTokens = normalizeActualTokenUsage(
      input.actualTokens,
      reservation.reservedTokens,
    );

    const updatedPeriod = await tx.aiUsagePeriod.update({
      where: { id: reservation.usagePeriodId },
      data: {
        usedTokens: {
          increment: actualTokens,
        },
        reservedTokens: Math.max(
          reservation.usagePeriod.reservedTokens -
            reservation.reservedTokens,
          0,
        ),
      },
    });

    await tx.aiUsageReservation.update({
      where: { id: reservation.id },
      data: {
        actualTokens,
        status: "COMMITTED",
      },
    });

    return usageSnapshot({
      limitTokens: input.limitTokens,
      usedTokens: updatedPeriod.usedTokens,
      reservedTokens: updatedPeriod.reservedTokens,
      periodStart: period.start,
      periodEnd: period.end,
    });
  });
}

export async function releaseAiUsage(input: {
  tenantId: string;
  reservationId: string;
}) {
  return prisma.$transaction(async (tx) => {
    await lockTenantMutation(tx, input.tenantId);

    const reservation = await tx.aiUsageReservation.findUnique({
      where: { id: input.reservationId },
      include: { usagePeriod: true },
    });

    if (
      !reservation ||
      reservation.usagePeriod.tenantId !== input.tenantId ||
      reservation.status !== "PENDING"
    ) {
      return false;
    }

    await tx.aiUsagePeriod.update({
      where: { id: reservation.usagePeriodId },
      data: {
        reservedTokens: Math.max(
          reservation.usagePeriod.reservedTokens -
            reservation.reservedTokens,
          0,
        ),
      },
    });

    await tx.aiUsageReservation.update({
      where: { id: reservation.id },
      data: { status: "RELEASED" },
    });

    return true;
  });
}
