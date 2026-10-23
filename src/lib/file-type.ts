// Short, human labels for stored file types ("application/pdf" -> "PDF"),
// decided by the MIME type first and the file extension second, for
// uploads whose browser sent a generic type.

import type { Locale } from "@/lib/i18n";

export type FileKind =
  | "pdf"
  | "word"
  | "excel"
  | "powerpoint"
  | "image"
  | "text"
  | "archive"
  | "audio"
  | "video"
  | "other";

const MIME_KINDS: Record<string, FileKind> = {
  "application/pdf": "pdf",
  "application/msword": "word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "word",
  "application/vnd.oasis.opendocument.text": "word",
  "application/rtf": "word",
  "application/vnd.ms-excel": "excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
  "application/vnd.oasis.opendocument.spreadsheet": "excel",
  "text/csv": "excel",
  "application/vnd.ms-powerpoint": "powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "powerpoint",
  "application/zip": "archive",
  "application/x-zip-compressed": "archive",
  "application/x-rar-compressed": "archive",
  "application/vnd.rar": "archive",
  "application/x-7z-compressed": "archive",
};

const EXTENSION_KINDS: Record<string, FileKind> = {
  pdf: "pdf",
  doc: "word",
  docx: "word",
  odt: "word",
  rtf: "word",
  xls: "excel",
  xlsx: "excel",
  ods: "excel",
  csv: "excel",
  ppt: "powerpoint",
  pptx: "powerpoint",
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  heic: "image",
  txt: "text",
  zip: "archive",
  rar: "archive",
  "7z": "archive",
  mp3: "audio",
  m4a: "audio",
  wav: "audio",
  mp4: "video",
  mov: "video",
};

const LABELS: Record<FileKind, Record<Locale, string>> = {
  pdf: { ar: "PDF", en: "PDF" },
  word: { ar: "Word", en: "Word" },
  excel: { ar: "Excel", en: "Excel" },
  powerpoint: { ar: "PowerPoint", en: "PowerPoint" },
  image: { ar: "صورة", en: "Image" },
  text: { ar: "نص", en: "Text" },
  archive: { ar: "ملف مضغوط", en: "Archive" },
  audio: { ar: "صوت", en: "Audio" },
  video: { ar: "فيديو", en: "Video" },
  other: { ar: "ملف", en: "File" },
};

export function fileKind(mimeType?: string | null, fileName?: string | null): FileKind {
  const mime = mimeType?.split(";")[0].trim().toLowerCase() ?? "";

  if (MIME_KINDS[mime]) return MIME_KINDS[mime];
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime === "text/plain") return "text";

  const extension = fileName?.match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase();
  return (extension && EXTENSION_KINDS[extension]) || "other";
}

export function fileTypeLabel(
  mimeType?: string | null,
  fileName?: string | null,
  locale: Locale = "en",
) {
  return LABELS[fileKind(mimeType, fileName)][locale];
}
