import "server-only";

import { inflateRawSync } from "node:zlib";
import sharp from "sharp";

export const DOCUMENT_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const RECEIPT_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

type ValidationResult =
  | { ok: true }
  | { ok: false; message: string; code: string };

const MIME_EXTENSIONS: Record<string, Set<string>> = {
  "application/pdf": new Set([".pdf"]),
  "image/png": new Set([".png"]),
  "image/jpeg": new Set([".jpg", ".jpeg"]),
  "image/webp": new Set([".webp"]),
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    new Set([".docx"]),
};

const DANGEROUS_ZIP_EXTENSIONS = new Set([
  ".bat",
  ".cmd",
  ".com",
  ".dll",
  ".exe",
  ".hta",
  ".jar",
  ".js",
  ".msi",
  ".ps1",
  ".scr",
  ".vbs",
]);

const MAX_DOCX_ENTRIES = 2_048;
const MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const MAX_DOCX_ENTRY_BYTES = 20 * 1024 * 1024;

function failure(code: string, message: string): ValidationResult {
  return { ok: false, code, message };
}

function extensionOf(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  const index = normalized.lastIndexOf(".");
  return index >= 0 ? normalized.slice(index) : "";
}

function hasPrefix(buffer: Buffer, prefix: Buffer, offset = 0) {
  return (
    buffer.length >= offset + prefix.length &&
    buffer.subarray(offset, offset + prefix.length).equals(prefix)
  );
}

function validateFileName(fileName: string, mimeType: string) {
  if (!fileName || fileName.length > 180 || /[\u0000-\u001f]/.test(fileName)) {
    return failure("INVALID_FILE_NAME", "اسم الملف غير صالح");
  }

  const allowedExtensions = MIME_EXTENSIONS[mimeType];

  if (!allowedExtensions?.has(extensionOf(fileName))) {
    return failure(
      "FILE_EXTENSION_MISMATCH",
      "امتداد الملف لا يطابق نوع محتواه",
    );
  }

  return { ok: true } as const;
}

async function validateImage(buffer: Buffer, mimeType: string) {
  const isJpeg = mimeType === "image/jpeg";
  const isPng = mimeType === "image/png";
  const isWebp = mimeType === "image/webp";

  const signatureOk =
    (isJpeg && hasPrefix(buffer, Buffer.from([0xff, 0xd8, 0xff]))) ||
    (isPng &&
      hasPrefix(buffer, Buffer.from("89504e470d0a1a0a", "hex"))) ||
    (isWebp &&
      hasPrefix(buffer, Buffer.from("RIFF")) &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP");

  if (!signatureOk) {
    return failure("INVALID_IMAGE_SIGNATURE", "محتوى الصورة غير صالح");
  }

  if (
    isJpeg &&
    !buffer
      .subarray(Math.max(0, buffer.length - 2))
      .equals(Buffer.from([0xff, 0xd9]))
  ) {
    return failure(
      "INVALID_IMAGE_END",
      "ملف الصورة غير مكتمل أو يحتوي بيانات إضافية",
    );
  }

  const pngEnd = Buffer.from("0000000049454e44ae426082", "hex");

  if (
    isPng &&
    !buffer.subarray(Math.max(0, buffer.length - pngEnd.length)).equals(pngEnd)
  ) {
    return failure(
      "INVALID_IMAGE_END",
      "ملف الصورة غير مكتمل أو يحتوي بيانات إضافية",
    );
  }

  if (isWebp) {
    if (buffer.length < 12 || buffer.readUInt32LE(4) !== buffer.length - 8) {
      return failure("INVALID_IMAGE_SIZE", "بنية صورة WebP غير صالحة");
    }
  }

  try {
    const image = sharp(buffer, {
      failOn: "error",
      limitInputPixels: 50_000_000,
    });
    const metadata = await image.metadata();
    const expectedFormat = isJpeg ? "jpeg" : isPng ? "png" : "webp";

    if (
      metadata.format !== expectedFormat ||
      !metadata.width ||
      !metadata.height ||
      (metadata.pages && metadata.pages !== 1)
    ) {
      return failure("IMAGE_FORMAT_MISMATCH", "صيغة الصورة لا تطابق نوع الملف");
    }

    await image.stats();
  } catch {
    return failure("IMAGE_DECODE_FAILED", "تعذر قراءة الصورة أو أن الملف تالف");
  }

  return { ok: true } as const;
}

function validatePdf(buffer: Buffer) {
  const headerArea = buffer.subarray(0, Math.min(buffer.length, 1_024));
  const headerOffset = headerArea.indexOf(Buffer.from("%PDF-"));

  if (headerOffset < 0) {
    return failure("INVALID_PDF_SIGNATURE", "محتوى ملف PDF غير صالح");
  }

  const header = headerArea
    .subarray(headerOffset, headerOffset + 8)
    .toString("ascii");

  if (!/^%PDF-[12]\.\d/.test(header)) {
    return failure("INVALID_PDF_VERSION", "إصدار ملف PDF غير صالح");
  }

  const eofMarker = Buffer.from("%%EOF");
  const eofOffset = buffer.lastIndexOf(eofMarker);

  if (eofOffset < 0) {
    return failure("INCOMPLETE_PDF", "ملف PDF غير مكتمل");
  }

  const trailing = buffer
    .subarray(eofOffset + eofMarker.length)
    .toString("latin1");

  if (!/^[\s\u0000]*$/.test(trailing)) {
    return failure(
      "PDF_TRAILING_DATA",
      "ملف PDF يحتوي بيانات إضافية غير مسموحة",
    );
  }

  const lowerContent = buffer.toString("latin1").toLowerCase();
  const activePdfMarkers = [
    "/javascript",
    "/launch",
    "/richmedia",
    "/embeddedfile",
  ];

  if (
    activePdfMarkers.some((marker) => lowerContent.includes(marker)) ||
    /\/js\b/.test(lowerContent)
  ) {
    return failure(
      "ACTIVE_PDF_CONTENT",
      "ملف PDF يحتوي محتوى نشطًا أو مرفقات غير مسموحة",
    );
  }

  return { ok: true } as const;
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minimumOffset = Math.max(0, buffer.length - 65_557);

  for (let offset = buffer.length - 22; offset >= minimumOffset; offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }

  return -1;
}

function readZipEntryData(
  buffer: Buffer,
  localHeaderOffset: number,
  compressedSize: number,
  compressionMethod: number,
  expectedUncompressedSize: number,
) {
  if (
    localHeaderOffset < 0 ||
    localHeaderOffset + 30 > buffer.length ||
    buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50
  ) {
    throw new Error("INVALID_LOCAL_HEADER");
  }

  const fileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const dataOffset = localHeaderOffset + 30 + fileNameLength + extraLength;
  const dataEnd = dataOffset + compressedSize;

  if (dataOffset < 0 || dataEnd > buffer.length) {
    throw new Error("INVALID_ENTRY_BOUNDS");
  }

  const compressed = buffer.subarray(dataOffset, dataEnd);

  if (compressionMethod === 0) return compressed;

  return inflateRawSync(compressed, {
    maxOutputLength: Math.min(
      Math.max(expectedUncompressedSize, 1),
      MAX_DOCX_ENTRY_BYTES,
    ),
  });
}

function validateDocx(buffer: Buffer) {
  if (!hasPrefix(buffer, Buffer.from("504b0304", "hex"))) {
    return failure("INVALID_DOCX_SIGNATURE", "محتوى ملف DOCX غير صالح");
  }

  const eocdOffset = findEndOfCentralDirectory(buffer);

  if (eocdOffset < 0) {
    return failure("INVALID_DOCX_ARCHIVE", "بنية ملف DOCX غير مكتملة");
  }

  const commentLength = buffer.readUInt16LE(eocdOffset + 20);

  if (eocdOffset + 22 + commentLength !== buffer.length) {
    return failure(
      "DOCX_TRAILING_DATA",
      "ملف DOCX يحتوي بيانات إضافية غير مسموحة",
    );
  }

  const diskNumber = buffer.readUInt16LE(eocdOffset + 4);
  const directoryDisk = buffer.readUInt16LE(eocdOffset + 6);
  const entriesOnDisk = buffer.readUInt16LE(eocdOffset + 8);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const directorySize = buffer.readUInt32LE(eocdOffset + 12);
  const directoryOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (
    diskNumber !== 0 ||
    directoryDisk !== 0 ||
    entriesOnDisk !== totalEntries ||
    totalEntries <= 0 ||
    totalEntries > MAX_DOCX_ENTRIES ||
    totalEntries === 0xffff ||
    directoryOffset === 0xffffffff ||
    directorySize === 0xffffffff ||
    directoryOffset + directorySize > eocdOffset
  ) {
    return failure(
      "UNSAFE_DOCX_ARCHIVE",
      "بنية ملف DOCX غير مدعومة أو غير آمنة",
    );
  }

  const requiredEntries = new Set([
    "[content_types].xml",
    "_rels/.rels",
    "word/document.xml",
  ]);
  let totalUncompressed = 0;
  let offset = directoryOffset;
  let contentTypesXml = "";

  for (let index = 0; index < totalEntries; index++) {
    if (
      offset + 46 > eocdOffset ||
      buffer.readUInt32LE(offset) !== 0x02014b50
    ) {
      return failure("INVALID_DOCX_DIRECTORY", "دليل ملف DOCX غير صالح");
    }

    const madeBy = buffer.readUInt16LE(offset + 4);
    const flags = buffer.readUInt16LE(offset + 8);
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const entryCommentLength = buffer.readUInt16LE(offset + 32);
    const externalAttributes = buffer.readUInt32LE(offset + 38);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const entryEnd =
      offset + 46 + fileNameLength + extraLength + entryCommentLength;

    if (entryEnd > eocdOffset || fileNameLength <= 0) {
      return failure("INVALID_DOCX_ENTRY", "أحد مكونات ملف DOCX غير صالح");
    }

    const entryName = buffer
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString("utf8");
    const normalizedName = entryName.toLowerCase();
    const pathParts = normalizedName.split("/");
    const hostSystem = madeBy >> 8;
    const unixMode = externalAttributes >>> 16;
    const isSymlink = hostSystem === 3 && (unixMode & 0o170000) === 0o120000;

    if (
      !entryName ||
      entryName.includes("\\") ||
      entryName.includes("\u0000") ||
      entryName.startsWith("/") ||
      /^[a-z]:/i.test(entryName) ||
      pathParts.includes("..") ||
      isSymlink ||
      flags & 0x1 ||
      ![0, 8].includes(compressionMethod) ||
      localHeaderOffset >= directoryOffset
    ) {
      return failure("UNSAFE_DOCX_ENTRY", "ملف DOCX يحتوي مكونًا غير آمن");
    }

    totalUncompressed += uncompressedSize;

    if (
      uncompressedSize > MAX_DOCX_ENTRY_BYTES ||
      totalUncompressed > MAX_DOCX_UNCOMPRESSED_BYTES ||
      (compressedSize === 0 && uncompressedSize > 0) ||
      (compressedSize > 0 && uncompressedSize / compressedSize > 100)
    ) {
      return failure(
        "DOCX_EXPANSION_LIMIT",
        "حجم محتوى DOCX بعد فك الضغط غير آمن",
      );
    }

    const extension = extensionOf(normalizedName);

    if (
      normalizedName === "word/vbaproject.bin" ||
      normalizedName.startsWith("word/embeddings/") ||
      DANGEROUS_ZIP_EXTENSIONS.has(extension)
    ) {
      return failure(
        "DOCX_ACTIVE_CONTENT",
        "ملف DOCX يحتوي مرفقات أو محتوى تنفيذي غير مسموح",
      );
    }

    requiredEntries.delete(normalizedName);

    if (
      normalizedName === "[content_types].xml" ||
      normalizedName.endsWith(".rels") ||
      normalizedName.endsWith(".xml")
    ) {
      try {
        const xml = readZipEntryData(
          buffer,
          localHeaderOffset,
          compressedSize,
          compressionMethod,
          uncompressedSize,
        ).toString("utf8");
        const lowerXml = xml.toLowerCase();

        if (lowerXml.includes("<!doctype") || lowerXml.includes("<!entity")) {
          return failure(
            "DOCX_XML_ENTITY",
            "ملف DOCX يحتوي تعريفات XML غير مسموحة",
          );
        }

        if (normalizedName === "[content_types].xml") {
          contentTypesXml = lowerXml;
        }
      } catch {
        return failure("DOCX_DECOMPRESSION_FAILED", "تعذر فحص مكونات ملف DOCX");
      }
    }

    offset = entryEnd;
  }

  if (requiredEntries.size > 0) {
    return failure("DOCX_REQUIRED_FILES_MISSING", "الملف ليس مستند DOCX صالحًا");
  }

  if (
    !contentTypesXml.includes(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
    ) ||
    contentTypesXml.includes("macroenabled")
  ) {
    return failure("DOCX_CONTENT_TYPE_MISMATCH", "نوع مستند DOCX غير مسموح");
  }

  return { ok: true } as const;
}

export async function validateUploadFileContent(options: {
  buffer: Buffer;
  fileName: string;
  declaredMimeType: string;
  allowedMimeTypes: ReadonlySet<string>;
}): Promise<ValidationResult> {
  const { buffer, fileName, declaredMimeType, allowedMimeTypes } = options;

  if (!allowedMimeTypes.has(declaredMimeType)) {
    return failure("UNSUPPORTED_FILE_TYPE", "نوع الملف غير مسموح");
  }

  if (!buffer.length) {
    return failure("EMPTY_FILE", "لا يمكن رفع ملف فارغ");
  }

  const fileNameValidation = validateFileName(fileName, declaredMimeType);
  if (!fileNameValidation.ok) return fileNameValidation;

  if (declaredMimeType.startsWith("image/")) {
    return validateImage(buffer, declaredMimeType);
  }

  if (declaredMimeType === "application/pdf") {
    return validatePdf(buffer);
  }

  if (
    declaredMimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return validateDocx(buffer);
  }

  return failure("UNSUPPORTED_FILE_TYPE", "نوع الملف غير مسموح");
}
