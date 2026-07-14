"use client";
import AppLoader from "@/components/ui/AppLoader";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import EmptyState from "@/components/ui/EmptyState";
import PageLoader from "@/components/ui/PageLoader";
import DocumentPreviewModal from "@/components/documents/DocumentPreviewModal";
import { fileSizeLabel, relativeTime } from "@/lib/utils";
import {
  getApiMessage,
  isPlanLimitResponse,
  planLimitMessage,
} from "@/lib/plan-ui";
import { translations, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/useLocale";
import SubscriptionReadOnlyBanner from "@/components/billing/SubscriptionReadOnlyBanner";
import { useTenantWriteAccess } from "@/hooks/useTenantWriteAccess";

interface Doc {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  fileSize?: number;
  createdAt: string;
  client?: {
    id?: string;
    name: string;
    archivedAt?: string | null;
  } | null;
  case?: {
    id?: string;
    title: string;
    client?: {
      id?: string;
      name: string;
      archivedAt?: string | null;
    } | null;
  } | null;
  aiSummary?: string | null;
  aiKeyPoints?: string[] | null;
  aiParties?: string[] | null;
  aiDates?: string[] | null;
  aiAmounts?: string[] | null;
  aiAnalyzedAt?: string | null;
  tags?: string[];
}

interface ClientItem {
  id: string;
  name: string;
  archivedAt?: string | null;
}

interface CaseItem {
  id: string;
  title: string;
  caseNumber?: string | null;
  clientId?: string | null;
  client?: {
    id?: string;
    name?: string;
    archivedAt?: string | null;
  } | null;
}

type Filter = "all" | "pdf" | "image" | "doc";
type UploadStatus = "idle" | "compressing" | "uploading";

type UploadContext = {
  caseId?: string;
  clientId?: string;
  tag?: string;
};

type CompressionResult = {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressed: boolean;
};

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_INPUT_SIZE_BYTES = 25 * 1024 * 1024;
const IMAGE_COMPRESSION_MIN_SIZE_BYTES = 450 * 1024;
const IMAGE_COMPRESSION_MAX_SIDE = 2200;
const IMAGE_COMPRESSION_QUALITY = 0.86;

function isCompressibleImageFile(file: File) {
  return ["image/jpeg", "image/png", "image/webp"].includes(file.type);
}

function replaceFileExtension(fileName: string, extension: string) {
  const cleanExtension = extension.startsWith(".")
    ? extension
    : `.${extension}`;
  const baseName = fileName.replace(/\.[^/.]+$/, "");
  return `${baseName || "document"}${cleanExtension}`;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Image compression failed"));
      },
      type,
      quality,
    );
  });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };

    image.src = url;
  });
}

async function compressImageForUpload(file: File): Promise<CompressionResult> {
  if (
    !isCompressibleImageFile(file) ||
    file.size < IMAGE_COMPRESSION_MIN_SIZE_BYTES
  ) {
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      compressed: false,
    };
  }

  const image = await loadImage(file);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  if (!sourceWidth || !sourceHeight) {
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      compressed: false,
    };
  }

  const scale = Math.min(
    1,
    IMAGE_COMPRESSION_MAX_SIDE / Math.max(sourceWidth, sourceHeight),
  );
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d", {
    alpha: file.type !== "image/jpeg",
  });

  if (!context) {
    throw new Error("Canvas is not supported");
  }

  if (file.type === "image/jpeg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, targetWidth, targetHeight);
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const outputType = file.type === "image/png" ? "image/webp" : file.type;
  const outputExtension =
    outputType === "image/webp" ? "webp" : file.name.split(".").pop() || "jpg";
  const blob = await canvasToBlob(
    canvas,
    outputType,
    IMAGE_COMPRESSION_QUALITY,
  );

  if (blob.size >= file.size) {
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      compressed: false,
    };
  }

  const compressedFile = new File(
    [blob],
    outputType === file.type
      ? file.name
      : replaceFileExtension(file.name, outputExtension),
    { type: outputType, lastModified: Date.now() },
  );

  return {
    file: compressedFile,
    originalSize: file.size,
    compressedSize: compressedFile.size,
    compressed: true,
  };
}

const FILE_ICON: Record<string, { label: string; color: string }> = {
  "application/pdf": { label: "PDF", color: "#ef4444" },
  "image/jpeg": { label: "JPG", color: "#ec4899" },
  "image/png": { label: "PNG", color: "#8b5cf6" },
  "image/webp": { label: "IMG", color: "#8b5cf6" },
  "application/msword": { label: "DOC", color: "#2563eb" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    label: "DOCX",
    color: "#2563eb",
  },
};

const FILTERS: Filter[] = ["all", "pdf", "image", "doc"];

const AVAILABLE_TAGS = [
  { value: "عقد", key: "contract" },
  { value: "قضية", key: "case" },
  { value: "هوية", key: "identity" },
  { value: "حكم", key: "judgment" },
  { value: "إثبات", key: "evidence" },
  { value: "لائحة", key: "pleading" },
  { value: "مالية", key: "financial" },
] as const;

function getIcon(type: string) {
  return FILE_ICON[type] ?? { label: "FILE", color: "#6b7280" };
}

function isImage(type: string) {
  return type.startsWith("image/");
}

function isWord(type: string) {
  return type.includes("word");
}

function PlanLimitBanner({
  message,
  onClose,
  title,
  billingLabel,
  closeLabel,
}: {
  message: string;
  onClose: () => void;
  title: string;
  billingLabel: string;
  closeLabel: string;
}) {
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-black">{title}</h2>
          <p className="mt-1 text-sm">{message}</p>
        </div>

        <div className="flex gap-2">
          <Link href="/dashboard/billing" className="btn btn-primary">
            {billingLabel}
          </Link>

          <button type="button" onClick={onClose} className="btn">
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadProgressIcon() {
  return (
    <div className="relative h-16 w-16" aria-hidden="true">
      <div className="absolute inset-0 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 shadow-[0_0_28px_rgba(53, 138, 136,0.18)]" />
      <div className="absolute inset-2 rounded-xl border border-emerald-300/20 bg-[#041819]" />

      <div className="absolute left-1/2 top-1/2 h-8 w-7 -translate-x-1/2 -translate-y-1/2 rounded-md border-2 border-emerald-200/80 bg-emerald-300/10">
        <div className="mx-auto mt-1 h-1 w-3 rounded-full bg-emerald-200/70" />
        <div className="mx-auto mt-1 h-1 w-4 rounded-full bg-emerald-200/40" />
        <div className="mx-auto mt-1 h-1 w-3 rounded-full bg-emerald-200/30" />
      </div>

      <div className="absolute -right-1 -top-1 flex h-7 w-7 animate-bounce items-center justify-center rounded-full border border-emerald-200/40 bg-emerald-500 text-xs font-black text-white shadow-lg">
        ↑
      </div>

      <div className="absolute inset-0 animate-spin rounded-2xl border-2 border-transparent border-l-emerald-300/40 border-t-emerald-300/80" />
    </div>
  );
}

export default function DocumentsPage() {
  const localeState = useLocale() as {
    locale?: Locale;
    t?: typeof translations.ar;
  };
  const locale = localeState?.locale === "en" ? "en" : "ar";
  const t = localeState?.t ?? translations[locale] ?? translations.ar;
  const d = t.documents ?? translations.ar.documents;
  const isRtl = locale === "ar";

  const linkCopy = {
    selectCase: isRtl ? "اختر قضية" : "Select a case",
    caseRequired: isRtl
      ? "يجب اختيار قضية قبل رفع المستند"
      : "Please select a case before uploading the document",
    clientAuto: isRtl
      ? "سيتم ربط الموكل تلقائياً من القضية"
      : "Client will be linked automatically from the selected case",
    selectCaseFirst: isRtl
      ? "اختر قضية لعرض الموكل المرتبط"
      : "Select a case to show the linked client",
    subtitle: isRtl
      ? "اختر القضية وسيتم ربط الموكل تلقائياً لتنظيم الأرشيف والبحث لاحقاً."
      : "Select a case and the client will be linked automatically for better archiving and search.",
  };

  const [docs, setDocs] = useState<Doc[]>([]);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [caseId, setCaseId] = useState("");
  const [clientId, setClientId] = useState("");
  const [uploadTag, setUploadTag] = useState("");

  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const uploadBusy =
    uploadStatus === "uploading" || uploadStatus === "compressing";
  const [planLimit, setPlanLimit] = useState("");
  const [preview, setPreview] = useState<Doc | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [modalFile, setModalFile] = useState<File | null>(null);
  const writeAccess = useTenantWriteAccess(locale);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isArchivedDoc = useCallback((doc: Doc) => {
    return Boolean(doc.client?.archivedAt || doc.case?.client?.archivedAt);
  }, []);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === clientId),
    [clients, clientId],
  );

  const selectedCase = useMemo(
    () => cases.find((caseItem) => caseItem.id === caseId),
    [cases, caseId],
  );

  const selectedCaseClient = selectedCase?.client ?? selectedClient ?? null;
  const selectedArchivedContext = Boolean(selectedCaseClient?.archivedAt);

  const modalCopy = {
    title: isRtl ? "رفع مستند جديد" : "Upload a new document",
    caseLabel: isRtl ? "القضية" : "Case",
    clientLabel: isRtl ? "الموكل المرتبط" : "Linked client",
    categoryLabel: isRtl ? "تصنيف المستند" : "Document category",
    fileLabel: isRtl ? "الملف" : "File",
    filePlaceholder: isRtl
      ? "اختر ملفاً من جهازك"
      : "Choose a file from your device",
    fileSelected: isRtl ? "الملف المحدد" : "Selected file",
    submit: isRtl ? "رفع المستند" : "Upload document",
    uploading: isRtl ? "جاري الرفع..." : "Uploading...",
    fileRequired: isRtl
      ? "اختر ملفاً قبل الرفع"
      : "Choose a file before uploading",
    clientMissing: isRtl
      ? "لم يتم العثور على الموكل المرتبط بالقضية"
      : "Could not find the client linked to this case",
    openHint: isRtl
      ? "اختر القضية أولاً، وسيظهر الموكل المرتبط تلقائياً قبل رفع الملف."
      : "Select the case first; the linked client will appear automatically before uploading.",
    noCases: isRtl
      ? "لا توجد قضايا متاحة للربط"
      : "No cases are available for linking",
    compressing: isRtl ? "جاري ضغط الملف..." : "Compressing file...",
    compressionHint: isRtl
      ? "سيتم ضغط الصور تلقائياً قبل الرفع لتقليل مساحة التخزين."
      : "Images are compressed automatically before upload to reduce storage usage.",
    compressionSuccess: isRtl ? "تم ضغط الصورة من" : "Image compressed from",
    compressionTo: isRtl ? "إلى" : "to",
  };

  function handleCaseChange(nextCaseId: string) {
    setCaseId(nextCaseId);

    const nextCase = cases.find((caseItem) => caseItem.id === nextCaseId);
    const nextClientId = nextCase?.client?.id ?? nextCase?.clientId ?? "";

    setClientId(nextClientId);
  }

  function openUploadModal() {
    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || d.messages.planLimitFallback);
      return;
    }

    setUploadModalOpen(true);
  }

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const [documentsRes, casesRes, clientsRes] = await Promise.all([
        fetch("/api/documents"),
        fetch("/api/cases?limit=100"),
        fetch("/api/clients?limit=100"),
      ]);

      const safeJson = async (response: Response) => {
        if (!response.ok) return { data: [] };

        try {
          return await response.json();
        } catch {
          return { data: [] };
        }
      };

      const [documentsData, casesData, clientsData] = await Promise.all([
        safeJson(documentsRes),
        safeJson(casesRes),
        safeJson(clientsRes),
      ]);

      setDocs(Array.isArray(documentsData.data) ? documentsData.data : []);
      setCases(
        Array.isArray(casesData.data?.data)
          ? casesData.data.data
          : Array.isArray(casesData.data)
            ? casesData.data
            : [],
      );
      setClients(
        Array.isArray(clientsData.data?.data)
          ? clientsData.data.data
          : Array.isArray(clientsData.data)
            ? clientsData.data
            : [],
      );
    } catch {
      toast.error(d.messages.loadError);
      setDocs([]);
      setCases([]);
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [d.messages.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!caseId) {
      if (clientId) setClientId("");
      return;
    }

    const currentCase = cases.find((caseItem) => caseItem.id === caseId);
    const currentClientId =
      currentCase?.client?.id ?? currentCase?.clientId ?? "";

    if (currentClientId && currentClientId !== clientId) {
      setClientId(currentClientId);
    }
  }, [caseId, cases, clientId]);

  const totalDocs = docs.length;
  const pdfCount = docs.filter(
    (doc) => doc.fileType === "application/pdf",
  ).length;
  const imageCount = docs.filter((doc) => isImage(doc.fileType)).length;
  const wordCount = docs.filter((doc) => isWord(doc.fileType)).length;

  const totalSize = useMemo(
    () => docs.reduce((sum, doc) => sum + (doc.fileSize ?? 0), 0),
    [docs],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return docs.filter((doc) => {
      const matchesSearch =
        !q ||
        doc.fileName.toLowerCase().includes(q) ||
        doc.client?.name?.toLowerCase().includes(q) ||
        doc.case?.title?.toLowerCase().includes(q);

      const matchesTag = !selectedTag || doc.tags?.includes(selectedTag);

      const matchesFilter =
        filter === "all" ||
        (filter === "pdf" && doc.fileType === "application/pdf") ||
        (filter === "image" && isImage(doc.fileType)) ||
        (filter === "doc" && isWord(doc.fileType));

      return matchesSearch && matchesFilter && matchesTag;
    });
  }, [docs, filter, search, selectedTag]);

  function clearFilters() {
    setSearch("");
    setFilter("all");
    setSelectedTag("");
  }

  async function upload(file: File, context: UploadContext = {}) {
    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || d.messages.planLimitFallback);
      return false;
    }

    const effectiveCaseId = context.caseId ?? caseId;
    const effectiveCase = cases.find(
      (caseItem) => caseItem.id === effectiveCaseId,
    );
    const effectiveClientId =
      context.clientId ??
      effectiveCase?.client?.id ??
      effectiveCase?.clientId ??
      clientId;
    const effectiveTag = context.tag ?? uploadTag;

    if (!effectiveCaseId) {
      toast.error(linkCopy.caseRequired);
      return false;
    }

    if (!effectiveClientId) {
      toast.error(modalCopy.clientMissing);
      return false;
    }

    if (effectiveCase?.client?.archivedAt) {
      toast.warning(d.messages.archivedUploadBlocked);
      return false;
    }

    if (
      isCompressibleImageFile(file) &&
      file.size > MAX_IMAGE_INPUT_SIZE_BYTES
    ) {
      toast.error(d.messages.fileTooLarge);
      return false;
    }

    if (!isCompressibleImageFile(file) && file.size > MAX_UPLOAD_SIZE_BYTES) {
      toast.error(d.messages.fileTooLarge);
      return false;
    }

    let fileToUpload = file;
    let compression: CompressionResult | null = null;

    try {
      setPlanLimit("");

      if (isCompressibleImageFile(file)) {
        setUploadStatus("compressing");
        compression = await compressImageForUpload(file);
        fileToUpload = compression.file;
      }

      if (fileToUpload.size > MAX_UPLOAD_SIZE_BYTES) {
        toast.error(d.messages.fileTooLarge);
        return false;
      }

      setUploadStatus("uploading");

      const formData = new FormData();
      formData.append("file", fileToUpload);
      formData.append("caseId", effectiveCaseId);
      formData.append("clientId", effectiveClientId);
      formData.append(
        "tags",
        JSON.stringify(effectiveTag ? [effectiveTag] : []),
      );
      formData.append("originalSizeBytes", String(file.size));
      formData.append("storedSizeBytes", String(fileToUpload.size));
      formData.append("compressed", compression?.compressed ? "true" : "false");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        if (isPlanLimitResponse(data)) {
          setPlanLimit(planLimitMessage(data, d.messages.planLimitFallback));
          return false;
        }

        toast.error(getApiMessage(data, d.messages.uploadError));
        return false;
      }

      if (compression?.compressed) {
        toast.success(
          `${modalCopy.compressionSuccess} ${fileSizeLabel(compression.originalSize)} ${modalCopy.compressionTo} ${fileSizeLabel(compression.compressedSize)}`,
        );
      }

      toast.success(d.messages.uploadSuccess);
      await load();
      return true;
    } catch {
      toast.error(d.messages.uploadUnexpectedError);
      return false;
    } finally {
      setUploadStatus("idle");
    }
  }

  async function handleModalUpload() {
    if (!modalFile) {
      toast.error(modalCopy.fileRequired);
      return;
    }

    const uploaded = await upload(modalFile);

    if (uploaded) {
      setUploadModalOpen(false);
      setModalFile(null);
    }
  }
  async function openPreview(doc: Doc) {
    try {
      const response = await fetch(`/api/documents/${doc.id}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(getApiMessage(data, d.messages.openError));
        return;
      }

      setPreview({ ...doc, fileUrl: data.data?.url ?? doc.fileUrl });
    } catch {
      toast.error(d.messages.openUnexpectedError);
    }
  }

  async function performDelete(id: string) {
    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || d.messages.planLimitFallback);
      return;
    }

    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(getApiMessage(data, d.messages.deleteError));
        return;
      }

      setDocs((previous) => previous.filter((doc) => doc.id !== id));
      toast.success(d.messages.deleteSuccess);
    } catch {
      toast.error(d.messages.deleteUnexpectedError);
    }
  }

  function handleDelete(id: string) {
    toast.custom((toastId) => (
      <div
        dir={isRtl ? "rtl" : "ltr"}
        className="w-[380px] max-w-[calc(100vw-32px)] rounded-3xl border p-5 shadow-2xl"
        style={{
          background: "var(--card)",
          borderColor: "rgba(248, 113, 113, 0.35)",
          color: "var(--text)",
        }}
      >
        <div className={isRtl ? "text-right" : "text-left"}>
          <p className="text-base font-black">
            {isRtl ? "حذف المستند" : "Delete document"}
          </p>

          <p
            className="mt-2 text-sm font-bold leading-6"
            style={{ color: "var(--text-2)" }}
          >
            {d.messages.confirmDelete}
          </p>
        </div>

        <div
          className={`mt-5 flex gap-2 ${
            isRtl ? "flex-row-reverse justify-start" : "justify-end"
          }`}
        >
          <button
            type="button"
            onClick={() => toast.dismiss(toastId)}
            className="rounded-2xl px-4 py-2 text-sm font-black transition"
            style={{
              background: "var(--green-soft)",
              color: "var(--text)",
            }}
          >
            {isRtl ? "إلغاء" : "Cancel"}
          </button>

          <button
            type="button"
            onClick={() => {
              toast.dismiss(toastId);
              void performDelete(id);
            }}
            className="rounded-2xl px-4 py-2 text-sm font-black text-white transition"
            style={{
              background: "linear-gradient(135deg, #dc2626, #991b1b)",
            }}
          >
            {isRtl ? "حذف" : "Delete"}
          </button>
        </div>
      </div>
    ));
  }

  async function handleSummarize(id: string) {
    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || d.messages.aiPlanLimitFallback);
      return;
    }

    try {
      setPlanLimit("");
      const toastId = toast.loading(d.messages.summarizing);

      const response = await fetch(`/api/documents/${id}/summarize`, {
        method: "POST",
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      toast.dismiss(toastId);

      if (!response.ok || !data?.success) {
        if (isPlanLimitResponse(data)) {
          setPlanLimit(planLimitMessage(data, d.messages.aiPlanLimitFallback));
          return;
        }

        toast.error(getApiMessage(data, d.messages.summarizeError));
        return;
      }

      toast.success(d.messages.summarizeSuccess);
      load();
    } catch {
      toast.error(d.messages.summarizeUnexpectedError);
    }
  }

  if (loading) {
    return <AppLoader fullScreen={false} />;
  }
  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-5 stagger">
      {planLimit && (
        <PlanLimitBanner
          message={planLimit}
          onClose={() => setPlanLimit("")}
          title={d.planLimit.title}
          billingLabel={d.planLimit.billing}
          closeLabel={d.planLimit.close}
        />
      )}

      <SubscriptionReadOnlyBanner
        visible={!writeAccess.canWrite}
        message={writeAccess.message}
        isRtl={isRtl}
      />

      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-[28px] border p-6"
        style={{
          background:
            "linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 60%, var(--sidebar-dark) 100%)",
          borderColor: "rgba(255,255,255,0.12)",
          boxShadow: "0 18px 50px rgba(15, 61, 62, 0.18)",
        }}
      >
        <div
          className="absolute -left-14 -top-14 h-40 w-40 rounded-full"
          style={{ background: "rgba(184, 115, 51, 0.16)" }}
        />

        <div
          className="absolute -bottom-20 right-16 h-52 w-52 rounded-full"
          style={{ background: "rgba(255,255,255,0.08)" }}
        />

        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="text-start">
            <div
              className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
              style={{
                background: "rgba(255,255,255,0.14)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              {d.hero.badge}
            </div>

            <h1 className="text-2xl font-black text-white">{d.hero.title}</h1>

            <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
              {d.hero.subtitle}
            </p>
          </div>

          <button
            type="button"
            disabled={!writeAccess.canWrite}
            title={
              !writeAccess.canWrite
                ? writeAccess.message || d.messages.planLimitFallback
                : d.actions.upload
            }
            onClick={openUploadModal}
            className="btn shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: "#fff",
              color: "var(--sidebar)",
              borderColor: "rgba(255,255,255,0.32)",
            }}
          >
            + {d.actions.upload}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: d.stats.total,
            value: totalDocs,
            color: "var(--text)",
            bg: "var(--card)",
          },
          {
            label: d.stats.pdf,
            value: pdfCount,
            color: "#dc2626",
            bg: "var(--red-soft)",
          },
          {
            label: d.stats.images,
            value: imageCount,
            color: "#7c3aed",
            bg: "var(--card)",
          },
          {
            label: d.stats.word,
            value: wordCount,
            color: "#2563eb",
            bg: "var(--green-soft)",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="card p-5 text-start"
            style={{
              background: item.bg,
              borderColor: "var(--border)",
            }}
          >
            <p className="text-xs font-black" style={{ color: item.color }}>
              {item.label}
            </p>

            <p
              className="mt-2 text-3xl font-black"
              style={{ color: item.color }}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>
      {/* Filters */}
      <div className="card p-4" dir={isRtl ? "rtl" : "ltr"}>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.5fr_.8fr_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={d.filters.searchPlaceholder}
            dir={isRtl ? "rtl" : "ltr"}
            style={{ textAlign: isRtl ? "right" : "left" }}
            className="input"
          />

          <select
            aria-label={d.filters.categoryAria}
            value={selectedTag}
            onChange={(event) => setSelectedTag(event.target.value)}
            dir={isRtl ? "rtl" : "ltr"}
            style={{ textAlign: isRtl ? "right" : "left" }}
            className="input"
          >
            <option dir={isRtl ? "rtl" : "ltr"} value="">
              {d.filters.allCategories}
            </option>

            {AVAILABLE_TAGS.map((tag) => (
              <option
                key={tag.value}
                dir={isRtl ? "rtl" : "ltr"}
                value={tag.value}
              >
                {d.tags[tag.key]}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={clearFilters}
            className="btn btn-ghost whitespace-nowrap"
          >
            {d.filters.apply}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap justify-start gap-2">
          {FILTERS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className="rounded-2xl px-4 py-2 text-xs font-black transition-all"
              style={
                filter === key
                  ? {
                      background: "var(--sidebar)",
                      color: "#fff",
                    }
                  : {
                      background: "var(--green-soft)",
                      color: "var(--text-2)",
                    }
              }
            >
              {d.filters.types[key]}
            </button>
          ))}

          {(search || filter !== "all" || selectedTag) && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-2xl px-4 py-2 text-xs font-black transition-all"
              style={{
                background: "var(--card)",
                color: "var(--text-2)",
                border: "1px solid var(--border)",
              }}
            >
              {d.filters.clear}
            </button>
          )}
        </div>
      </div>

      {/* Upload Area */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);

            if (!writeAccess.canWrite) {
              toast.warning(
                writeAccess.message || d.messages.planLimitFallback,
              );
              return;
            }

            if (!caseId) {
              toast.error(linkCopy.caseRequired);
              return;
            }

            if (selectedArchivedContext) {
              toast.warning(d.messages.archivedUploadBlocked);
              return;
            }

            const file = event.dataTransfer.files[0];
            if (file) upload(file);
          }}
          onClick={() => {
            if (!writeAccess.canWrite) {
              toast.warning(
                writeAccess.message || d.messages.planLimitFallback,
              );
              return;
            }

            if (!caseId) {
              toast.error(linkCopy.caseRequired);
              return;
            }

            if (selectedArchivedContext) {
              toast.warning(d.messages.archivedUploadBlocked);
              return;
            }

            fileInputRef.current?.click();
          }}
          className={`card flex min-h-[160px] flex-col items-center justify-center p-6 text-center transition-all ${
            !writeAccess.canWrite || selectedArchivedContext
              ? "cursor-not-allowed opacity-60"
              : "cursor-pointer"
          }`}
          style={{
            border: `2px dashed ${dragging ? "var(--sidebar)" : "var(--border-dark)"}`,
            background: dragging ? "var(--green-soft)" : "var(--card)",
          }}
        >
          <input
            aria-label={d.upload.fileAria}
            ref={fileInputRef}
            type="file"
            disabled={!writeAccess.canWrite || selectedArchivedContext}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload(file);
              event.currentTarget.value = "";
            }}
          />

          {uploadBusy ? (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col items-center gap-4"
            >
              <UploadProgressIcon />

              <div className="text-center">
                <p
                  className="text-sm font-black"
                  style={{ color: "var(--text)" }}
                >
                  {uploadStatus === "compressing"
                    ? modalCopy.compressing
                    : d.upload.uploading}
                </p>

                <p className="mt-1 text-xs" style={{ color: "var(--text-3)" }}>
                  {isRtl
                    ? "لا تغلق الصفحة حتى يكتمل الرفع"
                    : "Keep this page open until the upload finishes"}
                </p>
              </div>
            </div>
          ) : (
            <>
              <span className="text-4xl">{dragging ? "📂" : "📁"}</span>

              <p
                className="mt-4 text-base font-black"
                style={{ color: "var(--text)" }}
              >
                {d.upload.dragDrop}
              </p>

              <p className="mt-2 text-sm" style={{ color: "var(--text-3)" }}>
                {d.upload.hint}
              </p>
            </>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-4">
            <h3 className="font-black" style={{ color: "var(--text)" }}>
              {d.linkPanel.title}
            </h3>

            <p className="mt-1 text-xs" style={{ color: "var(--text-3)" }}>
              {linkCopy.subtitle}
            </p>
          </div>

          <div className="space-y-3">
            <select
              aria-label={d.linkPanel.caseAria}
              value={caseId}
              onChange={(event) => handleCaseChange(event.target.value)}
              dir={isRtl ? "rtl" : "ltr"}
              style={{ textAlign: isRtl ? "right" : "left" }}
              className="input"
            >
              <option dir={isRtl ? "rtl" : "ltr"} value="">
                {linkCopy.selectCase}
              </option>

              {cases.map((caseItem) => (
                <option
                  key={caseItem.id}
                  dir={isRtl ? "rtl" : "ltr"}
                  value={caseItem.id}
                >
                  {caseItem.title}
                  {caseItem.client?.name ? ` — ${caseItem.client.name}` : ""}
                </option>
              ))}
            </select>

            <div
              className="rounded-2xl border px-4 py-3 text-sm font-black"
              dir={isRtl ? "rtl" : "ltr"}
              style={{
                borderColor: "var(--border)",
                background: "var(--card)",
                color: selectedCaseClient?.name
                  ? "var(--text)"
                  : "var(--text-3)",
                textAlign: isRtl ? "right" : "left",
              }}
            >
              <p
                className="mb-1 text-xs font-black"
                style={{ color: "var(--text-3)" }}
              >
                {d.card.client}
              </p>

              <p>{selectedCaseClient?.name || linkCopy.selectCaseFirst}</p>

              <p
                className="mt-1 text-xs font-bold"
                style={{ color: "var(--text-3)" }}
              >
                {linkCopy.clientAuto}
              </p>
            </div>

            {selectedArchivedContext && (
              <div
                className="rounded-2xl border p-3 text-xs font-bold"
                style={{
                  background: "#fff7ed",
                  color: "#b45309",
                  borderColor: "rgba(180, 83, 9, 0.22)",
                }}
              >
                {d.linkPanel.archivedWarning}
              </div>
            )}

            <div>
              <p
                className="mb-2 text-xs font-black"
                style={{ color: "var(--text-3)" }}
              >
                {d.linkPanel.documentCategory}
              </p>

              <div className="flex flex-wrap gap-2">
                {AVAILABLE_TAGS.map((tag) => {
                  const active = uploadTag === tag.value;

                  return (
                    <button
                      key={tag.value}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setUploadTag(active ? "" : tag.value);
                      }}
                      className="rounded-full px-3 py-1.5 text-xs font-bold transition-all"
                      style={
                        active
                          ? { background: "var(--sidebar)", color: "#fff" }
                          : {
                              background: "var(--green-soft)",
                              color: "var(--text-2)",
                            }
                      }
                    >
                      {d.tags[tag.key]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className="rounded-2xl border p-3 text-xs font-bold"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-3)",
              }}
            >
              {d.linkPanel.totalSize}: {fileSizeLabel(totalSize)}
            </div>
          </div>
        </div>
      </div>
      {/* Content */}
      {filtered.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon="📄"
            title={d.empty.title}
            sub={docs.length === 0 ? d.empty.first : d.empty.filtered}
            action={
              docs.length === 0 ? (
                <button
                  type="button"
                  onClick={openUploadModal}
                  disabled={!writeAccess.canWrite}
                  title={
                    !writeAccess.canWrite
                      ? writeAccess.message || d.messages.planLimitFallback
                      : d.actions.upload
                  }
                  className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  + {d.actions.upload}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="btn btn-ghost"
                >
                  {d.filters.clear}
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((doc) => {
            const icon = getIcon(doc.fileType);
            const archivedDoc = isArchivedDoc(doc);

            return (
              <div
                key={doc.id}
                className="card group flex flex-col p-5 text-start transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className="flex h-14 w-12 shrink-0 items-center justify-center rounded-xl text-xs font-black text-white"
                      style={{ background: icon.color }}
                    >
                      {icon.label}
                    </div>

                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-black"
                        style={{ color: "var(--text)" }}
                      >
                        {doc.fileName}
                      </p>

                      <p
                        className="mt-1 text-xs"
                        style={{ color: "var(--text-3)" }}
                      >
                        {fileSizeLabel(doc.fileSize)} ·{" "}
                        {relativeTime(doc.createdAt)}
                      </p>
                    </div>
                  </div>

                  {!!doc.tags?.length && (
                    <span
                      className="shrink-0 rounded-full px-3 py-1 text-[11px] font-black"
                      style={{
                        background: "var(--green-soft)",
                        color: "var(--sidebar)",
                      }}
                    >
                      {AVAILABLE_TAGS.find((tag) => tag.value === doc.tags?.[0])
                        ? d.tags[
                            AVAILABLE_TAGS.find(
                              (tag) => tag.value === doc.tags?.[0],
                            )!.key
                          ]
                        : doc.tags[0]}
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  {doc.client?.name && (
                    <p
                      className="truncate text-xs font-bold"
                      style={{ color: "var(--text-2)" }}
                    >
                      👤 {d.card.client}: {doc.client.name}
                    </p>
                  )}

                  {archivedDoc && (
                    <span
                      className="inline-flex w-fit rounded-full px-3 py-1 text-[11px] font-black"
                      style={{
                        background: "#fff7ed",
                        color: "#b45309",
                        border: "1px solid rgba(180, 83, 9, 0.18)",
                      }}
                    >
                      {d.card.archivedClient}
                    </span>
                  )}

                  {doc.case?.title && (
                    <p
                      className="truncate text-xs font-bold"
                      style={{ color: "var(--text-2)" }}
                    >
                      ⚖️ {d.card.case}: {doc.case.title}
                    </p>
                  )}

                  {doc.aiAnalyzedAt && (
                    <p
                      className="text-xs font-bold"
                      style={{ color: "var(--sidebar)" }}
                    >
                      ✨ {d.card.aiAnalyzed}
                    </p>
                  )}
                </div>

                <div
                  className="mt-5 flex flex-wrap gap-2 border-t pt-4"
                  style={{ borderColor: "var(--border)" }}
                >
                  <button
                    type="button"
                    onClick={() => openPreview(doc)}
                    className="btn btn-ghost flex-1"
                    style={{ minWidth: 90 }}
                  >
                    {d.actions.preview}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSummarize(doc.id)}
                    disabled={!writeAccess.canWrite}
                    title={
                      !writeAccess.canWrite
                        ? writeAccess.message || d.messages.aiPlanLimitFallback
                        : d.actions.summarizeAi
                    }
                    className="btn flex-1 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      minWidth: 90,
                      background: "#7c3aed",
                      color: "#fff",
                    }}
                  >
                    {d.actions.summarizeAi}
                  </button>

                  <button
                    type="button"
                    disabled={!writeAccess.canWrite || archivedDoc}
                    title={
                      !writeAccess.canWrite
                        ? writeAccess.message || d.messages.planLimitFallback
                        : archivedDoc
                          ? d.messages.archivedDeleteBlocked
                          : d.actions.delete
                    }
                    onClick={() => {
                      if (!writeAccess.canWrite) {
                        toast.warning(
                          writeAccess.message || d.messages.planLimitFallback,
                        );
                        return;
                      }

                      if (archivedDoc) {
                        toast.warning(d.messages.archivedDeleteBlocked);
                        return;
                      }

                      handleDelete(doc.id);
                    }}
                    className="btn flex-1 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      minWidth: 90,
                      background: "#dc2626",
                      color: "#fff",
                    }}
                  >
                    {d.actions.delete}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {uploadModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm"
          dir={isRtl ? "rtl" : "ltr"}
          onClick={() => {
            if (!uploadBusy) {
              setUploadModalOpen(false);
              setModalFile(null);
            }
          }}
        >
          <div
            className="w-full max-w-xl rounded-[28px] border p-5 shadow-2xl md:p-6"
            onClick={(event) => event.stopPropagation()}
            style={{
              background: "var(--card)",
              borderColor: "var(--border-dark)",
              color: "var(--text)",
            }}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="text-start">
                <h2 className="text-xl font-black">{modalCopy.title}</h2>
                <p
                  className="mt-2 text-sm font-semibold leading-6"
                  style={{ color: "var(--text-3)" }}
                >
                  {modalCopy.openHint}
                </p>
              </div>

              <button
                type="button"
                aria-label={isRtl ? "إغلاق النافذة" : "Close modal"}
                title={isRtl ? "إغلاق" : "Close"}
                disabled={uploadBusy}
                onClick={() => {
                  setUploadModalOpen(false);
                  setModalFile(null);
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-black transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: "var(--green-soft)",
                  color: "var(--accent)",
                }}
              >
                <span aria-hidden="true" className="leading-none">
                  ×
                </span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="document-upload-case"
                  className="mb-2 block text-sm font-black"
                  style={{ color: "var(--text)" }}
                >
                  {modalCopy.caseLabel}
                </label>

                <select
                  id="document-upload-case"
                  aria-label={d.linkPanel.caseAria}
                  value={caseId}
                  onChange={(event) => handleCaseChange(event.target.value)}
                  disabled={uploadBusy || cases.length === 0}
                  dir={isRtl ? "rtl" : "ltr"}
                  style={{ textAlign: isRtl ? "right" : "left" }}
                  className="input disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option dir={isRtl ? "rtl" : "ltr"} value="">
                    {cases.length === 0
                      ? modalCopy.noCases
                      : linkCopy.selectCase}
                  </option>

                  {cases.map((caseItem) => (
                    <option
                      key={caseItem.id}
                      dir={isRtl ? "rtl" : "ltr"}
                      value={caseItem.id}
                    >
                      {caseItem.title ||
                        caseItem.caseNumber ||
                        linkCopy.selectCase}
                      {caseItem.client?.name
                        ? ` — ${caseItem.client.name}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className="rounded-2xl border px-4 py-3 text-start"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--green-soft)",
                }}
              >
                <p
                  className="text-xs font-black"
                  style={{ color: "var(--text-3)" }}
                >
                  {modalCopy.clientLabel}
                </p>

                <p
                  className="mt-1 text-sm font-black"
                  style={{
                    color: selectedCaseClient?.name
                      ? "var(--text)"
                      : "var(--text-3)",
                  }}
                >
                  {selectedCaseClient?.name || linkCopy.selectCaseFirst}
                </p>

                <p
                  className="mt-1 text-xs font-bold"
                  style={{ color: "var(--text-3)" }}
                >
                  {linkCopy.clientAuto}
                </p>
              </div>

              {selectedArchivedContext && (
                <div
                  className="rounded-2xl border p-3 text-xs font-bold"
                  style={{
                    background: "#fff7ed",
                    color: "#b45309",
                    borderColor: "rgba(180, 83, 9, 0.22)",
                  }}
                >
                  {d.linkPanel.archivedWarning}
                </div>
              )}

              <div>
                <p
                  className="mb-2 text-sm font-black"
                  style={{ color: "var(--text)" }}
                >
                  {modalCopy.categoryLabel}
                </p>

                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_TAGS.map((tag) => {
                    const active = uploadTag === tag.value;

                    return (
                      <button
                        key={tag.value}
                        type="button"
                        disabled={uploadBusy}
                        onClick={() => setUploadTag(active ? "" : tag.value)}
                        className="rounded-full px-3 py-1.5 text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-60"
                        style={
                          active
                            ? { background: "var(--sidebar)", color: "#fff" }
                            : {
                                background: "var(--green-soft)",
                                color: "var(--text-2)",
                              }
                        }
                      >
                        {d.tags[tag.key]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p
                  className="mb-2 text-sm font-black"
                  style={{ color: "var(--text)" }}
                >
                  {modalCopy.fileLabel}
                </p>

                <label
                  htmlFor="document-upload-file"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-5 text-center transition hover:opacity-90"
                  style={{
                    borderColor: "var(--border-dark)",
                    background: "var(--green-soft)",
                  }}
                >
                  <span className="text-3xl">📄</span>

                  <span
                    className="mt-2 text-sm font-black"
                    style={{ color: "var(--text)" }}
                  >
                    {modalFile
                      ? modalCopy.fileSelected
                      : modalCopy.filePlaceholder}
                  </span>

                  {modalFile && (
                    <span
                      className="mt-1 max-w-full truncate text-xs font-bold"
                      style={{ color: "var(--text-3)" }}
                    >
                      {modalFile.name} · {fileSizeLabel(modalFile.size)}
                    </span>
                  )}
                </label>

                <p
                  className="mt-2 text-xs font-bold"
                  style={{ color: "var(--text-3)" }}
                >
                  {modalCopy.compressionHint}
                </p>

                <input
                  id="document-upload-file"
                  type="file"
                  disabled={uploadBusy}
                  className="hidden"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    setModalFile(nextFile);
                    event.currentTarget.value = "";
                  }}
                />
              </div>

              <button
                type="button"
                disabled={
                  uploadBusy ||
                  !writeAccess.canWrite ||
                  !caseId ||
                  !clientId ||
                  !modalFile ||
                  selectedArchivedContext
                }
                onClick={handleModalUpload}
                className="btn btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploadStatus === "compressing"
                  ? modalCopy.compressing
                  : uploadStatus === "uploading"
                    ? modalCopy.uploading
                    : modalCopy.submit}
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <DocumentPreviewModal
          open={!!preview}
          onClose={() => setPreview(null)}
          documentId={preview.id}
          fileUrl={`/api/documents/${preview.id}/preview`}
          fileType={preview.fileType}
          fileName={preview.fileName}
          aiSummary={preview.aiSummary}
          aiKeyPoints={preview.aiKeyPoints}
          aiParties={preview.aiParties}
          aiDates={preview.aiDates}
          aiAmounts={preview.aiAmounts}
        />
      )}
    </div>
  );
}
