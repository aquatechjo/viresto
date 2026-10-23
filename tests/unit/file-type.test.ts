import assert from "node:assert/strict";
import test from "node:test";
import { fileKind, fileTypeLabel } from "../../src/lib/file-type";

test("MIME types map to short labels, never the raw type", () => {
  const cases: Array<[string, string]> = [
    ["application/pdf", "PDF"],
    ["APPLICATION/PDF", "PDF"],
    ["application/msword", "Word"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Word"],
    ["application/vnd.ms-excel", "Excel"],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Excel"],
    ["text/csv", "Excel"],
    ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "PowerPoint"],
    ["image/jpeg", "Image"],
    ["image/png", "Image"],
    ["text/plain; charset=utf-8", "Text"],
    ["application/zip", "Archive"],
    ["audio/mpeg", "Audio"],
    ["video/mp4", "Video"],
  ];

  for (const [mime, label] of cases) {
    assert.equal(fileTypeLabel(mime), label, mime);
  }
});

test("a generic or missing type falls back to the file extension", () => {
  assert.equal(fileKind("application/octet-stream", "وكالة عامة.pdf"), "pdf");
  assert.equal(fileKind("", "عقد.DOCX"), "word");
  assert.equal(fileKind(null, "scan.heic"), "image");
  assert.equal(fileKind(undefined, "notes"), "other");
  assert.equal(fileTypeLabel("application/x-unknown", "data.bin"), "File");
});

test("labels follow the locale", () => {
  assert.equal(fileTypeLabel("image/png", null, "ar"), "صورة");
  assert.equal(fileTypeLabel("application/pdf", null, "ar"), "PDF");
  assert.equal(fileTypeLabel("application/x-unknown", null, "ar"), "ملف");
});
