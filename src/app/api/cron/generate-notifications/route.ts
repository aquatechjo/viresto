import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { generateImportantNotifications } from "@/lib/notification-rules";
import { isBearerSecretAuthorized } from "@/lib/bearer-secret";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TENANT_CONCURRENCY = 5;

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const authHeader = req.headers.get("authorization");

    if (!process.env.CRON_SECRET) {
      return err("Cron secret is not configured", 500);
    }

    if (!isBearerSecretAuthorized(authHeader, process.env.CRON_SECRET)) {
      return err("Unauthorized", 401);
    }

    const tenants = await prisma.tenant.findMany({
      where: {
        isSuspended: false,
        status: { in: ["ACTIVE", "TRIAL"] },
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    let created = 0;
    let candidates = 0;
    const failedTenantIds: string[] = [];

    for (let index = 0; index < tenants.length; index += TENANT_CONCURRENCY) {
      const batch = tenants.slice(index, index + TENANT_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((tenant) => generateImportantNotifications(tenant.id)),
      );

      results.forEach((result, resultIndex) => {
        if (result.status === "fulfilled") {
          created += result.value.created;
          candidates += result.value.candidates;
          return;
        }

        const tenantId = batch[resultIndex]?.id;
        if (tenantId) failedTenantIds.push(tenantId);
        console.error("[NOTIFICATION_CRON_TENANT_ERROR]", tenantId, result.reason);
      });
    }

    return ok({
      processedTenants: tenants.length - failedTenantIds.length,
      failedTenants: failedTenantIds.length,
      candidates,
      created,
    });
  });
}
