import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import {
  type CloudinaryResourceType,
  fetchAuthenticatedCloudinaryAsset,
  isTenantCloudinaryAsset,
  streamPrivateAsset,
} from "@/lib/cloudinary";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function getRawObject(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  return raw as Record<string, unknown>;
}

function getReceiptMetadata(raw: unknown, paymentId: string) {
  const rawObject = getRawObject(raw);
  const savedResourceType = String(rawObject.resourceType || "");
  const fileType = String(rawObject.fileType || "application/octet-stream");
  const fileName = String(rawObject.fileName || `receipt-${paymentId}`);

  let resourceType: CloudinaryResourceType = "raw";

  if (
    savedResourceType === "image" ||
    savedResourceType === "raw" ||
    savedResourceType === "video"
  ) {
    resourceType = savedResourceType;
  } else if (fileType.startsWith("image/") || fileType === "application/pdf") {
    resourceType = "image";
  }

  return { fileName, fileType, resourceType };
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

    if (
      !isTenantCloudinaryAsset(
        payment.receiptPublicId,
        auth.user.tenantId,
        "receipts",
      )
    ) {
      console.error("Rejected receipt with invalid Cloudinary tenant prefix", {
        paymentId: payment.id,
        tenantId: auth.user.tenantId,
      });

      return err("مسار تخزين الإيصال غير صالح", 403);
    }

    const metadata = getReceiptMetadata(payment.raw, payment.id);
    const upstream = await fetchAuthenticatedCloudinaryAsset({
      publicId: payment.receiptPublicId,
      fileType: metadata.fileType,
      resourceTypes: [metadata.resourceType],
      range: req.headers.get("range"),
    });

    if (!upstream) {
      return NextResponse.json(
        { success: false, message: "تعذر تحميل إيصال الدفع" },
        { status: 404 },
      );
    }

    return streamPrivateAsset(upstream, {
      fileName: metadata.fileName,
      fallbackContentType: metadata.fileType,
      disposition:
        metadata.fileType.startsWith("image/") ||
        metadata.fileType === "application/pdf"
          ? "inline"
          : "attachment",
    });
  });
}
