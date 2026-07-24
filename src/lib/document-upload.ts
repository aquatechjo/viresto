import { z } from "zod";

export const DOCUMENT_MAX_STORED_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_MAX_IMAGE_INPUT_BYTES = 25 * 1024 * 1024;

export const DOCUMENT_UPLOAD_MIME_TYPE_VALUES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const cloudinaryResourceTypeSchema = z.enum(["image", "raw", "video"]);

export type CloudinaryResourceType = z.infer<
  typeof cloudinaryResourceTypeSchema
>;

export const documentUploadIntentSchema = z.object({
  caseId: z.string().trim().min(1).max(100),
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.enum(DOCUMENT_UPLOAD_MIME_TYPE_VALUES),
  fileSize: z.number().int().positive().max(DOCUMENT_MAX_STORED_BYTES),
  notes: z.string().trim().max(1_000).nullable().optional(),
  tags: z
    .array(z.string().trim().min(1).max(50))
    .max(10)
    .optional()
    .default([]),
});

export const documentUploadCompletionSchema =
  documentUploadIntentSchema.extend({
    upload: z.object({
      publicId: z.string().trim().min(1).max(300),
      secureUrl: z.string().url().max(2_000),
      resourceType: cloudinaryResourceTypeSchema,
      bytes: z.number().int().positive().max(DOCUMENT_MAX_STORED_BYTES),
      version: z.number().int().positive(),
      signature: z.string().regex(/^[a-f0-9]{40,64}$/i),
    }),
  });

export function isTrustedCloudinaryUrl(value: string, cloudName: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      url.pathname.startsWith(`/${cloudName}/`)
    );
  } catch {
    return false;
  }
}

export function isExpectedCloudinaryResourceType(
  mimeType: (typeof DOCUMENT_UPLOAD_MIME_TYPE_VALUES)[number],
  resourceType: CloudinaryResourceType,
) {
  if (mimeType.startsWith("image/")) return resourceType === "image";
  if (mimeType === "application/pdf") {
    return resourceType === "image" || resourceType === "raw";
  }

  return resourceType === "raw";
}
