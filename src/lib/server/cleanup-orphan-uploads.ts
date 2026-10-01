import "server-only";

import cloudinary from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";

// Deletes document uploads that were never finalized. The browser uploads
// straight to Cloudinary with a signature from /api/upload/sign and then
// registers the file via /api/upload; an asset with no Document row after
// a day was abandoned (or uploaded only to consume storage) and is removed.
// Runs from the daily /api/cron/prune-activity.
//
// Only "Viresto/<tenant>/documents/<id>" authenticated assets are ever
// considered; anything else in the Cloudinary account is left alone.

export const ORPHAN_UPLOAD_MAX_AGE_HOURS = 24;

const RESOURCE_TYPES = ["image", "raw"] as const;
const DOCUMENT_PATH = /^Viresto\/[^/]+\/documents\/[^/]+$/;
const PAGE_SIZE = 500;
const MAX_PAGES_PER_TYPE = 20;
const DELETE_BATCH = 100;

type CloudinaryResource = { public_id: string; created_at: string };
type ResourcesPage = { resources: CloudinaryResource[]; next_cursor?: string };

export type OrphanUploadCleanupResult =
  | { status: "not_configured"; checked: 0; deleted: 0 }
  | { status: "ok"; checked: number; deleted: number };

// Raw assets may carry the file extension in Cloudinary but not in our row.
function withoutExtension(publicId: string) {
  return publicId.replace(/\.[a-z0-9]{2,5}$/i, "");
}

export async function cleanupOrphanUploads(
  now = new Date(),
): Promise<OrphanUploadCleanupResult> {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    return { status: "not_configured", checked: 0, deleted: 0 };
  }

  const cutoff = now.getTime() - ORPHAN_UPLOAD_MAX_AGE_HOURS * 3_600_000;
  let checked = 0;
  let deleted = 0;

  for (const resourceType of RESOURCE_TYPES) {
    let cursor: string | undefined;
    let pages = 0;

    do {
      const page = (await cloudinary.api.resources({
        type: "authenticated",
        resource_type: resourceType,
        prefix: "Viresto/",
        max_results: PAGE_SIZE,
        ...(cursor ? { next_cursor: cursor } : {}),
      })) as ResourcesPage;

      cursor = page.next_cursor;
      pages += 1;

      const old = page.resources.filter(
        (resource) =>
          DOCUMENT_PATH.test(withoutExtension(resource.public_id)) &&
          new Date(resource.created_at).getTime() < cutoff,
      );
      checked += old.length;

      if (old.length === 0) continue;

      const ids = old.map((resource) => resource.public_id);
      const known = new Set(
        (
          await prisma.document.findMany({
            where: {
              publicId: { in: [...new Set(ids.flatMap((id) => [id, withoutExtension(id)]))] },
            },
            select: { publicId: true },
          })
        ).map((document) => document.publicId),
      );

      const orphans = ids.filter((id) => !known.has(id) && !known.has(withoutExtension(id)));

      for (let index = 0; index < orphans.length; index += DELETE_BATCH) {
        const batch = orphans.slice(index, index + DELETE_BATCH);
        await cloudinary.api.delete_resources(batch, {
          type: "authenticated",
          resource_type: resourceType,
        });
        deleted += batch.length;
      }
    } while (cursor && pages < MAX_PAGES_PER_TYPE);
  }

  return { status: "ok", checked, deleted };
}
