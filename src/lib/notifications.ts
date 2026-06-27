import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type CreateNotificationInput = {
  tenantId: string;
  userId?: string | null;
  type?: NotificationType;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  href?: string | null;
};

export async function createNotification({
  tenantId,
  userId = null,
  type = NotificationType.INFO,
  titleAr,
  titleEn,
  messageAr,
  messageEn,
  href = null,
}: CreateNotificationInput) {
  try {
    return await prisma.notification.create({
      data: {
        tenantId,
        userId,
        type,
        titleAr,
        titleEn,
        messageAr,
        messageEn,
        href,
      },
    });
  } catch (error) {
    console.error("[NOTIFICATION_CREATE_ERROR]", error);
    return null;
  }
}

export async function createTenantNotification(input: Omit<CreateNotificationInput, "userId">) {
  return createNotification({
    ...input,
    userId: null,
  });
}
