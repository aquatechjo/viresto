"use client";

type ApiPayload = {
  success?: boolean;
  message?: string;
  data?: Record<string, unknown>;
  details?: Record<string, unknown>;
};

type SignedUpload = {
  uploadUrl: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
  type: "authenticated";
};

type CloudinaryUploadResponse = {
  public_id?: string;
  secure_url?: string;
  resource_type?: "image" | "raw" | "video";
  bytes?: number;
  version?: number;
  signature?: string;
  error?: {
    message?: string;
  };
};

export type DirectDocumentUploadResult = {
  ok: boolean;
  status: number;
  data: ApiPayload;
};

async function readJson(response: Response): Promise<ApiPayload> {
  return response.json().catch(() => ({}));
}

export async function uploadDocumentDirect(input: {
  file: File;
  caseId: string;
  notes?: string | null;
  tags?: string[];
}): Promise<DirectDocumentUploadResult> {
  const intent = {
    caseId: input.caseId,
    fileName: input.file.name,
    mimeType: input.file.type,
    fileSize: input.file.size,
    notes: input.notes?.trim() || null,
    tags: input.tags ?? [],
  };

  const signResponse = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(intent),
  });
  const signPayload = await readJson(signResponse);

  if (!signResponse.ok || !signPayload.success) {
    return {
      ok: false,
      status: signResponse.status,
      data: signPayload,
    };
  }

  const signed = signPayload.data as SignedUpload | undefined;

  if (
    !signed?.uploadUrl ||
    !signed.apiKey ||
    !signed.signature ||
    !signed.publicId
  ) {
    return {
      ok: false,
      status: 502,
      data: { message: "استجابة تجهيز رفع الملف غير صالحة" },
    };
  }

  const uploadForm = new FormData();
  uploadForm.append("file", input.file, input.file.name);
  uploadForm.append("api_key", signed.apiKey);
  uploadForm.append("timestamp", String(signed.timestamp));
  uploadForm.append("signature", signed.signature);
  uploadForm.append("folder", signed.folder);
  uploadForm.append("public_id", signed.publicId);
  uploadForm.append("type", signed.type);
  uploadForm.append("overwrite", "false");

  const cloudinaryResponse = await fetch(signed.uploadUrl, {
    method: "POST",
    body: uploadForm,
  });
  const cloudinaryPayload =
    (await cloudinaryResponse
      .json()
      .catch(() => ({}))) as CloudinaryUploadResponse;

  if (!cloudinaryResponse.ok) {
    return {
      ok: false,
      status: 502,
      data: {
        message:
          cloudinaryPayload.error?.message ||
          "تعذر رفع الملف إلى خدمة التخزين",
      },
    };
  }

  const completionBody = {
    ...intent,
    upload: {
      publicId: cloudinaryPayload.public_id,
      secureUrl: cloudinaryPayload.secure_url,
      resourceType: cloudinaryPayload.resource_type,
      bytes: cloudinaryPayload.bytes,
      version: cloudinaryPayload.version,
      signature: cloudinaryPayload.signature,
    },
  };

  let completionResponse: Response;

  try {
    completionResponse = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(completionBody),
    });
  } catch {
    completionResponse = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(completionBody),
    });
  }

  const completionPayload = await readJson(completionResponse);

  return {
    ok: completionResponse.ok && completionPayload.success === true,
    status: completionResponse.status,
    data: completionPayload,
  };
}
