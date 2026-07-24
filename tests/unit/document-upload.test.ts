import assert from "node:assert/strict";
import test from "node:test";
import {
  DOCUMENT_MAX_STORED_BYTES,
  documentUploadIntentSchema,
  isExpectedCloudinaryResourceType,
  isTrustedCloudinaryUrl,
} from "../../src/lib/document-upload";

const validIntent = {
  caseId: "case-1",
  fileName: "evidence.pdf",
  mimeType: "application/pdf" as const,
  fileSize: DOCUMENT_MAX_STORED_BYTES,
  notes: null,
  tags: ["قضية"],
};

test("document upload accepts the exact stored-size boundary", () => {
  assert.equal(documentUploadIntentSchema.safeParse(validIntent).success, true);
});

test("document upload rejects the first byte above the stored-size boundary", () => {
  const result = documentUploadIntentSchema.safeParse({
    ...validIntent,
    fileSize: DOCUMENT_MAX_STORED_BYTES + 1,
  });

  assert.equal(result.success, false);
});

test("document upload rejects unsupported content types and excessive tags", () => {
  assert.equal(
    documentUploadIntentSchema.safeParse({
      ...validIntent,
      mimeType: "text/html",
    }).success,
    false,
  );
  assert.equal(
    documentUploadIntentSchema.safeParse({
      ...validIntent,
      tags: Array.from({ length: 11 }, (_, index) => `tag-${index}`),
    }).success,
    false,
  );
});

test("Cloudinary asset URLs stay restricted to the configured cloud", () => {
  assert.equal(
    isTrustedCloudinaryUrl(
      "https://res.cloudinary.com/viresto/image/authenticated/v1/file.pdf",
      "viresto",
    ),
    true,
  );
  assert.equal(
    isTrustedCloudinaryUrl(
      "https://res.cloudinary.com/other/image/authenticated/v1/file.pdf",
      "viresto",
    ),
    false,
  );
  assert.equal(
    isTrustedCloudinaryUrl(
      "https://example.com/viresto/image/authenticated/v1/file.pdf",
      "viresto",
    ),
    false,
  );
});

test("Cloudinary resource types match the declared document type", () => {
  assert.equal(isExpectedCloudinaryResourceType("image/png", "image"), true);
  assert.equal(isExpectedCloudinaryResourceType("image/png", "raw"), false);
  assert.equal(
    isExpectedCloudinaryResourceType("application/pdf", "image"),
    true,
  );
  assert.equal(
    isExpectedCloudinaryResourceType(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "raw",
    ),
    true,
  );
});
