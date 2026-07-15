import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { generateSignedFileUrl } from "@/lib/cloudinary";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type CloudinaryResourceType = "image" | "raw" | "video";

function getRawObject(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  return raw as Record<string, unknown>;
}

function getReceiptResourceType(raw: unknown): CloudinaryResourceType {
  const rawObject = getRawObject(raw);

  const savedResourceType =
    typeof rawObject.resourceType === "string" ? rawObject.resourceType : "";

  if (
    savedResourceType === "image" ||
    savedResourceType === "raw" ||
    savedResourceType === "video"
  ) {
    return savedResourceType;
  }

  const fileType =
    typeof rawObject.fileType === "string" ? rawObject.fileType : "";

  if (fileType.startsWith("image/") || fileType === "application/pdf") {
    return "image";
  }

  return "raw";
}

export async function GET(req: NextRequest, context: RouteContext) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

    const { id } = await context.params;

    const payment = await prisma.subscriptionPayment.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
        receiptPublicId: {
          not: null,
        },
      },
      select: {
        id: true,
        receiptPublicId: true,
        raw: true,
      },
    });

    if (!payment?.receiptPublicId) {
      return err("إيصال الدفع غير موجود", 404);
    }

    const resourceType = getReceiptResourceType(payment.raw);
    const signedUrl = generateSignedFileUrl(payment.receiptPublicId, resourceType);

    return ok({
      signedUrl,
      resourceType,
    });
  });
}
