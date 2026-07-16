"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useLocale } from "@/lib/useLocale";

type Locale = "ar" | "en";

interface Props {
  open: boolean;
  onClose: () => void;
  fileUrl: string;
  fileType: string;
  fileName: string;
  documentId: string;
  aiSummary?: string | null;
  aiKeyPoints?: string[] | null;
  aiParties?: string[] | null;
  aiDates?: string[] | null;
  aiAmounts?: string[] | null;
  locale?: Locale;
}

const COPY = {
  ar: {
    close: "إغلاق",
    pdfUnavailable: "تعذر عرض PDF داخل النظام",
    pdfHint: "يمكنك فتح الملف في تبويب جديد أو تحميله.",
    openNewTab: "فتح في تبويب جديد",
    downloadFile: "تحميل الملف",
    unsupportedPreview: "المعاينة غير مدعومة لهذا النوع",
    aiTitle: "تحليل المستند AI",
    summary: "الملخص",
    keyPoints: "النقاط الرئيسية",
    parties: "الأطراف",
    dates: "التواريخ",
    amounts: "المبالغ",
    noAnalysis: "لم يتم تحليل هذا المستند بعد.",
  },
  en: {
    close: "Close",
    pdfUnavailable: "PDF preview is not available inside the system",
    pdfHint: "You can open the file in a new tab or download it.",
    openNewTab: "Open in new tab",
    downloadFile: "Download file",
    unsupportedPreview: "Preview is not supported for this file type",
    aiTitle: "AI document analysis",
    summary: "Summary",
    keyPoints: "Key points",
    parties: "Parties",
    dates: "Dates",
    amounts: "Amounts",
    noAnalysis: "This document has not been analyzed yet.",
  },
} as const;

export default function DocumentPreviewModal({
  open,
  onClose,
  documentId,
  fileUrl,
  fileType,
  fileName,
  aiSummary,
  aiKeyPoints,
  aiParties,
  aiDates,
  aiAmounts,
  locale: localeProp,
}: Props) {
  const localeState = useLocale() as { locale?: Locale };
  const locale: Locale =
    localeProp ?? (localeState?.locale === "en" ? "en" : "ar");
  const isRtl = locale === "ar";
  const t = COPY[locale];

  const isImage = fileType.startsWith("image/");
  const isPdf = fileType === "application/pdf";
  const previewUrl = `/api/documents/${documentId}/preview`;
  const chipAlign = isRtl ? "justify-end" : "justify-start";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          dir={isRtl ? "rtl" : "ltr"}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="h-[90vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] text-[var(--text-1)] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            initial={{
              opacity: 0,
              y: 30,
              scale: 0.95,
              rotateX: -7,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              rotateX: 0,
            }}
            exit={{
              opacity: 0,
              y: 18,
              scale: 0.97,
            }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 25,
            }}
          >
            <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <motion.div
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg"
                  style={{
                    background: "var(--green-soft)",
                    color: "var(--sidebar)",
                  }}
                  initial={{ rotate: -12, scale: 0.8 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ delay: 0.12, type: "spring" }}
                  aria-hidden="true"
                >
                  {isPdf ? "📄" : isImage ? "🖼️" : "📁"}
                </motion.div>

                <h2 className="truncate text-sm font-bold">{fileName}</h2>
              </div>

              <motion.button
                type="button"
                onClick={onClose}
                aria-label={t.close}
                title={t.close}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500 text-white transition hover:bg-red-600"
                whileHover={{ scale: 1.06, rotate: 3 }}
                whileTap={{ scale: 0.94 }}
              >
                ✕
              </motion.button>
            </div>

            <div className="grid h-[calc(90vh-73px)] grid-cols-1 md:grid-cols-[1.4fr_.8fr]">
              <motion.div
                className="flex min-h-0 items-center justify-center bg-black"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.12 }}
              >
                {isImage && (
                  <motion.img
                    src={fileUrl}
                    alt={fileName}
                    className="max-h-full max-w-full object-contain"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.18, duration: 0.35 }}
                  />
                )}

                {isPdf && (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-black p-6 text-center text-white">
                    <motion.div
                      className="relative grid h-24 w-20 place-items-center rounded-xl border border-white/20 bg-white/10 text-4xl shadow-2xl"
                      initial={{ y: 14, rotate: -5, opacity: 0 }}
                      animate={{ y: 0, rotate: 0, opacity: 1 }}
                      transition={{ delay: 0.15, type: "spring" }}
                      aria-hidden="true"
                    >
                      📄
                      <span className="absolute -bottom-2 -right-3 rounded-lg bg-red-500 px-2 py-1 text-[10px] font-black text-white">
                        PDF
                      </span>
                    </motion.div>

                    <p className="text-lg font-bold">{t.pdfUnavailable}</p>
                    <p className="text-sm text-white/70">{t.pdfHint}</p>

                    <div className="flex flex-wrap justify-center gap-3">
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800"
                      >
                        {t.openNewTab}
                      </a>

                      <a
                        href={`${previewUrl}?download=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-slate-100"
                      >
                        {t.downloadFile}
                      </a>
                    </div>
                  </div>
                )}

                {!isImage && !isPdf && (
                  <div className="p-6 text-center text-sm text-white">
                    {t.unsupportedPreview}
                  </div>
                )}
              </motion.div>

              <motion.aside
                className="min-h-0 overflow-y-auto border-t border-[var(--border)] bg-[var(--surface)] p-5 text-start md:border-l md:border-t-0"
                initial={{ opacity: 0, x: isRtl ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.16, duration: 0.3 }}
              >
                <h3 className="mb-4 text-lg font-bold text-[var(--text-1)]">
                  {t.aiTitle}
                </h3>

                {aiSummary ? (
                  <div className="space-y-5">
                    <section>
                      <h4 className="mb-2 font-bold text-[var(--accent)]">
                        {t.summary}
                      </h4>
                      <p className="text-sm leading-7 text-[var(--text-2)]">
                        {aiSummary}
                      </p>
                    </section>

                    {!!aiKeyPoints?.length && (
                      <section>
                        <h4 className="mb-2 font-bold text-[var(--text-1)]">
                          {t.keyPoints}
                        </h4>
                        <ul className="space-y-2 text-sm text-[var(--text-2)]">
                          {aiKeyPoints.map((item, index) => (
                            <motion.li
                              key={`${item}-${index}`}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.22 + index * 0.04 }}
                            >
                              • {item}
                            </motion.li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {!!aiParties?.length && (
                      <ChipSection
                        title={t.parties}
                        items={aiParties}
                        chipAlign={chipAlign}
                      />
                    )}

                    {!!aiDates?.length && (
                      <ChipSection
                        title={t.dates}
                        items={aiDates}
                        chipAlign={chipAlign}
                      />
                    )}

                    {!!aiAmounts?.length && (
                      <ChipSection
                        title={t.amounts}
                        items={aiAmounts}
                        chipAlign={chipAlign}
                      />
                    )}
                  </div>
                ) : (
                  <motion.div
                    className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-5 text-center"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.24 }}
                  >
                    <p className="text-sm text-[var(--text-3)]">{t.noAnalysis}</p>
                  </motion.div>
                )}
              </motion.aside>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ChipSection({
  title,
  items,
  chipAlign,
}: {
  title: string;
  items: string[];
  chipAlign: string;
}) {
  return (
    <section>
      <h4 className="mb-2 font-bold text-[var(--text-1)]">{title}</h4>
      <div className={`flex flex-wrap gap-2 ${chipAlign}`}>
        {items.map((item, index) => (
          <motion.span
            key={`${item}-${index}`}
            className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs text-[var(--text-2)]"
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.22 + index * 0.04 }}
          >
            {item}
          </motion.span>
        ))}
      </div>
    </section>
  );
}