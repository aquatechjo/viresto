import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type NotificationBaseInput = {
  tenantId: string;
  userId?: string | null;
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
   * Useful for due-soon / overdue / billing notifications.
   */
  dedupeMinutes?: number;

  /**
   * Allows routes to skip notification creation without wrapping conditions outside.
   */
  skip?: boolean;
};

type CreateNotificationInput = NotificationBaseInput & NotificationOptions;

type CreateTenantNotificationInput = Omit<NotificationBaseInput, "userId"> &
  NotificationOptions;

type CreateUserNotificationInput = Omit<NotificationBaseInput, "userId"> & {
  userId: string;
} & NotificationOptions;

function normalizeNullable(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function createNotification({
  tenantId,
  userId = null,
  type = NotificationType.INFO,
  titleAr,
  titleEn,
  messageAr,
  messageEn,
  href = null,
  dedupeMinutes = 0,
  skip = false,
}: CreateNotificationInput) {
  if (skip) return null;

  const normalizedUserId = normalizeNullable(userId);
  const normalizedHref = normalizeNullable(href);

  try {
    if (dedupeMinutes > 0) {
      const since = new Date(Date.now() - dedupeMinutes * 60 * 1000);

      const existing = await prisma.notification.findFirst({
        where: {
          tenantId,
          userId: normalizedUserId,
          type,
          titleAr,
          titleEn,
          messageAr,
          messageEn,
          href: normalizedHref,
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
 * Tenant-wide notification: visible to all users in the same office/tenant.
 * Use this for billing, system, office-level reminders, and shared alerts.
 */
export async function createTenantNotification(input: CreateTenantNotificationInput) {
  return createNotification({
    ...input,
    userId: null,
  });
}

/**
 * User-specific notification: visible to one user plus tenant admins only if your API permits it.
 * Use this later for assigned tasks, personal reminders, or security alerts.
 */
export async function createUserNotification(input: CreateUserNotificationInput) {
  return createNotification(input);
}

export function isPastDate(value?: Date | string | null) {
  if (!value) return false;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  return date.getTime() < Date.now();
}

export function isWithinNextHours(value: Date | string | null | undefined, hours: number) {
  if (!value || hours <= 0) return false;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const now = Date.now();
  const target = date.getTime();
  const max = now + hours * 60 * 60 * 1000;

  return target >= now && target <= max;
}
