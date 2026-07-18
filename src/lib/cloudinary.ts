import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { externalFetch } from "@/lib/external-fetch";

export type CloudinaryResourceType = "image" | "raw" | "video";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
  timeout: 10_000,
});

export function generateSignedFileUrl(
  publicId: string,
  resourceType: CloudinaryResourceType = "raw",
) {
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: "authenticated",
    sign_url: true,
    secure: true,
  });
}

export function generatePrivateDownloadUrl(
  publicId: string,
  format = "pdf",
  resourceType: "image" | "raw" = "image",
) {
  return cloudinary.utils.private_download_url(publicId, format, {
    resource_type: resourceType,
    type: "authenticated",
    attachment: false,
  });
}

export function isTenantCloudinaryAsset(
  publicId: string,
  tenantId: string,
  subfolder?: string,
) {
  const normalizedSubfolder = subfolder?.replace(/^\/+|\/+$/g, "");
  const prefix = normalizedSubfolder
    ? `Viresto/${tenantId}/${normalizedSubfolder}/`
    : `Viresto/${tenantId}/`;

  return publicId.startsWith(prefix);
}

function getPublicIdCandidates(publicId: string, fileType?: string | null) {
  if (
    fileType === "application/pdf" &&
    !publicId.toLowerCase().endsWith(".pdf")
  ) {
    return [publicId, `${publicId}.pdf`];
  }

  return [publicId];
}

function safeRangeHeader(range?: string | null) {
  if (!range) return null;
  return /^bytes=(?:\d+-\d*|-\d+)(?:,(?:\d+-\d*|-\d+))*$/.test(range)
    ? range
    : null;
}

export async function fetchAuthenticatedCloudinaryAsset(options: {
  publicId: string;
  fileType?: string | null;
  resourceTypes: CloudinaryResourceType[];
  range?: string | null;
}) {
  const range = safeRangeHeader(options.range);
  const headers = range ? { Range: range } : undefined;

  for (const publicId of getPublicIdCandidates(
    options.publicId,
    options.fileType,
  )) {
    for (const resourceType of options.resourceTypes) {
      const url =
        options.fileType === "application/pdf" && resourceType === "image"
          ? generatePrivateDownloadUrl(publicId, "pdf", "image")
          : generateSignedFileUrl(publicId, resourceType);

      try {
        const response = await externalFetch(
          url,
          {
            cache: "no-store",
            headers,
          },
          10_000,
        );

        const contentType = response.headers.get("content-type") || "";
        const rejectedContent =
          contentType.includes("text/html") ||
          contentType.includes("application/json");

        if (response.status === 416) {
          return response;
        }

        if (response.ok && !rejectedContent && response.body) {
          return response;
        }

        await response.body?.cancel().catch(() => undefined);
      } catch (error) {
        console.error("Cloudinary asset fetch failed:", error);
      }
    }
  }

  return null;
}

function safeAsciiFileName(fileName: string) {
  return fileName
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_")
    .slice(0, 180);
}

export function streamPrivateAsset(
  upstream: Response,
  options: {
    fileName: string;
    fallbackContentType?: string | null;
    disposition?: "inline" | "attachment";
  },
) {
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Disposition": `${options.disposition || "inline"}; filename="${safeAsciiFileName(options.fileName)}"; filename*=UTF-8''${encodeURIComponent(options.fileName)}`,
    "Content-Type":
      upstream.headers.get("content-type") ||
      options.fallbackContentType ||
      "application/octet-stream",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
  });

  for (const name of [
    "accept-ranges",
    "content-length",
    "content-range",
    "etag",
    "last-modified",
  ]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}

export default cloudinary;
