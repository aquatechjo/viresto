import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/log-activity";
import { streamOfficeDataExport } from "@/lib/office-data-export";

// AUDIT_REPORT.md M4: the office ADMIN downloads all office data as one
// JSON file. Reachable while the office is locked (isSubscriptionExemptPath),
// so an office that stopped paying can still take its data out.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

    const limit = await checkRateLimit(auth.user.tenantId, {
      keyPrefix: "office-export",
      windowMs: 60 * 60 * 1000,
      max: 5,
    });
    if (!limit.allowed) {
      return err("تم تجاوز عدد مرات التصدير المسموح، حاول بعد ساعة", 429);
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: auth.user.tenantId },
      select: { slug: true },
    });
    if (!tenant) return err("المكتب غير موجود", 404);

    await logActivity({
      req,
      tenantId: auth.user.tenantId,
      actorId: auth.user.userId,
      type: "DATA_EXPORTED",
      title: "تم تصدير بيانات المكتب كاملة",
      message: auth.user.email,
      entityType: "TENANT",
      entityId: auth.user.tenantId,
    });

    const exportedAt = new Date();
    const chunks = streamOfficeDataExport(auth.user.tenantId, exportedAt);
    const encoder = new TextEncoder();
    const tenantId = auth.user.tenantId;

    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const next = await chunks.next();
          if (next.done) controller.close();
          else controller.enqueue(encoder.encode(next.value));
        } catch (error) {
          // Abort rather than end: a cut-off file must not look complete.
          console.error(`[office-export] failed tenant=${tenantId}`, error);
          controller.error(error);
        }
      },
      async cancel() {
        await chunks.return(undefined);
      },
    });

    const date = exportedAt.toISOString().slice(0, 10);

    return new Response(body, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="viresto-export-${tenant.slug.replace(/[^A-Za-z0-9_-]/g, "") || "office"}-${date}.json"`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  });
}
