import { prisma } from "@/lib/prisma";

// Idempotency for incoming webhooks, keyed by the standard-webhooks
// "webhook-id" header, which Polar keeps identical across retries of the
// same delivery. A delivery is marked only after it was processed
// successfully, so one that failed (5xx) is still processed on retry.

export type WebhookSource = "polar";

// How long handled deliveries are remembered; far beyond Polar's retry window.
export const PROCESSED_WEBHOOK_RETENTION_DAYS = 30;

export async function wasWebhookProcessed(source: WebhookSource, webhookId: string) {
  const row = await prisma.processedWebhook.findUnique({
    where: { source_webhookId: { source, webhookId } },
    select: { webhookId: true },
  });

  return row !== null;
}

export async function markWebhookProcessed(
  source: WebhookSource,
  webhookId: string,
  eventType: string,
) {
  // skipDuplicates: two concurrent deliveries of the same id both succeed.
  await prisma.processedWebhook.createMany({
    data: [{ source, webhookId, eventType }],
    skipDuplicates: true,
  });
}
