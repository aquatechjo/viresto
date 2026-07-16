import "server-only";
import sharp from "sharp";

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_INPUT_SIZE_BYTES = 25 * 1024 * 1024;
const MIN_IMAGE_SIZE_FOR_COMPRESSION = 450 * 1024;
const IMAGE_COMPRESSION_MAX_SIDE = 2200;
const IMAGE_COMPRESSION_QUALITY = 86;
const MIN_SAVING_RATIO = 0.05;

const COMPRESSIBLE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface PreparedUploadFile {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  size: number;
  originalSize: number;
  wasCompressed: boolean;
}

function replaceFileExtension(fileName: string, extension: string) {
  const cleanExtension = extension.startsWith(".") ? extension : `.${extension}`;
  const baseName = fileName.replace(/\.[^/.]+$/, "");
  return `${baseName || "document"}${cleanExtension}`;
}

function originalPreparedFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): PreparedUploadFile {
  return {
    buffer,
    fileName,
    mimeType,
    size: buffer.length,
    originalSize: buffer.length,
    wasCompressed: false,
  };
}

export async function prepareUploadFile(
  file: File,
  sourceBuffer?: Buffer,
): Promise<PreparedUploadFile> {
  const originalBuffer = sourceBuffer ?? Buffer.from(await file.arrayBuffer());
  const originalFileName = file.name || "document";
  const originalMimeType = file.type || "application/octet-stream";

  if (!COMPRESSIBLE_IMAGE_TYPES.has(originalMimeType)) {
    return originalPreparedFile(originalBuffer, originalFileName, originalMimeType);
  }

  if (originalBuffer.length > MAX_IMAGE_INPUT_SIZE_BYTES) {
    throw new Error("IMAGE_TOO_LARGE_TO_COMPRESS");
  }

  if (originalBuffer.length < MIN_IMAGE_SIZE_FOR_COMPRESSION) {
    return originalPreparedFile(originalBuffer, originalFileName, originalMimeType);
  }

  const metadata = await sharp(originalBuffer, {
    limitInputPixels: 50_000_000,
  }).metadata();

  const width = metadata.width || 0;
  const height = metadata.height || 0;

  const needsResize =
    width > IMAGE_COMPRESSION_MAX_SIDE || height > IMAGE_COMPRESSION_MAX_SIDE;

  const needsOptimization =
    originalMimeType !== "image/webp" ||
    originalBuffer.length > 1200 * 1024;

  if (!needsResize && !needsOptimization) {
    return originalPreparedFile(originalBuffer, originalFileName, originalMimeType);
  }

  const compressedBuffer = await sharp(originalBuffer, {
    limitInputPixels: 50_000_000,
  })
    .rotate()
    .resize({
      width: IMAGE_COMPRESSION_MAX_SIDE,
      height: IMAGE_COMPRESSION_MAX_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: IMAGE_COMPRESSION_QUALITY,
      effort: 4,
    })
    .toBuffer();

  const savedEnough =
    compressedBuffer.length <= originalBuffer.length * (1 - MIN_SAVING_RATIO);

  if (!savedEnough) {
    return originalPreparedFile(originalBuffer, originalFileName, originalMimeType);
  }

  return {
    buffer: compressedBuffer,
    fileName: replaceFileExtension(originalFileName, ".webp"),
    mimeType: "image/webp",
    size: compressedBuffer.length,
    originalSize: originalBuffer.length,
    wasCompressed: true,
  };
}

export function validatePreparedUploadSize(prepared: PreparedUploadFile) {
  return prepared.size <= MAX_UPLOAD_SIZE_BYTES;
}
