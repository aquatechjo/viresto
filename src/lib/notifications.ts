import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type NotificationBaseInput = {
  tenantId: string;
  userId?: string | null;
  dedupeKey?: string | null;
  type?: NotificationType;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  href?: string | null;
};

type NotificationOptions = {
  /**
   * Prevents duplicate notifications with the same content inside this time window.
   * Useful for temporary dedupe.
   */
  dedupeMinutes?: number;

  /**
   * Prevents creating the same notification again at any time.
   * Useful for rule-based notifications generated from /api/notifications.
   */
  dedupeForever?: boolean;

  /**
   * Allows callers to skip notification creation without wrapping conditions outside.
   */
  skip?: boolean;
};

type CreateNotificationInput = NotificationBaseInput & NotificationOptions;

type CreateUserNotificationInput = Omit<NotificationBaseInput, "userId"> & {
  userId: string;
} & NotificationOptions;

export type BatchNotificationInput = NotificationBaseInput & {
  userId: string;
  dedupeKey: string;
};

function normalizeNullable(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function createNotification({
  tenantId,
  userId = null,
  dedupeKey = null,
  type = NotificationType.INFO,
  titleAr,
  titleEn,
  messageAr,
  messageEn,
  href = null,
  dedupeMinutes = 0,
  dedupeForever = false,
  skip = false,
}: CreateNotificationInput) {
  if (skip) return null;

  const normalizedUserId = normalizeNullable(userId);
  const normalizedHref = normalizeNullable(href);
  const normalizedDedupeKey = normalizeNullable(dedupeKey);
  const baseDedupeWhere = {
    tenantId,
    userId: normalizedUserId,
    type,
    titleAr,
    titleEn,
    messageAr,
    messageEn,
    href: normalizedHref,
  };
  try {
    if (normalizedDedupeKey) {
      return await prisma.notification.upsert({
        where: {
          tenantId_dedupeKey: {
            tenantId,
            dedupeKey: normalizedDedupeKey,
          },
        },
        update: {},
        create: {
          tenantId,
          userId: normalizedUserId,
          dedupeKey: normalizedDedupeKey,
          type,
          titleAr,
          titleEn,
          messageAr,
          messageEn,
          href: normalizedHref,
        },
      });
    }

    if (dedupeForever) {
      const existing = await prisma.notification.findFirst({
        where: baseDedupeWhere,
        orderBy: {
          createdAt: "desc",
        },
      });

      if (existing) return existing;
    }
    if (dedupeMinutes > 0) {
      const since = new Date(Date.now() - dedupeMinutes * 60 * 1000);

      const existing = await prisma.notification.findFirst({
        where: {
          ...baseDedupeWhere,
          createdAt: {
            gte: since,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (existing) return existing;
    }

    return await prisma.notification.create({
      data: {
        tenantId,
        userId: normalizedUserId,
        dedupeKey: normalizedDedupeKey,
        type,
        titleAr,
        titleEn,
        messageAr,
        messageEn,
        href: normalizedHref,
      },
    });
  } catch (error) {
    console.error("[NOTIFICATION_CREATE_ERROR]", error);
    return null;
  }
}

/**
 * Inserts rule-generated notifications in one query. The database uniqueness
 * constraint makes this operation safe when two cron invocations overlap.
 */
export async function createNotificationsBatch(
  items: BatchNotificationInput[],
) {
  if (items.length === 0) return { count: 0 };

  return prisma.notification.createMany({
    data: items.map((item) => ({
      tenantId: item.tenantId,
      userId: item.userId.trim(),
      dedupeKey: item.dedupeKey.trim(),
      type: item.type ?? NotificationType.INFO,
      titleAr: item.titleAr,
      titleEn: item.titleEn,
      messageAr: item.messageAr,
      messageEn: item.messageEn,
      href: normalizeNullable(item.href),
    })),
    skipDuplicates: true,
  });
}

/**
 * User-specific notification: visible only to the intended user.
 */
export async function createUserNotification(
  input: CreateUserNotificationInput,
) {
  return createNotification(input);
}

export function isPastDate(value?: Date | string | null) {
  if (!value) return false;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  return date.getTime() < Date.now();
}

export function isWithinNextHours(
  value: Date | string | null | undefined,
  hours: number,
) {
  if (!value || hours <= 0) return false;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const now = Date.now();
  const target = date.getTime();
  const max = now + hours * 60 * 60 * 1000;

  return target >= now && target <= max;
}
