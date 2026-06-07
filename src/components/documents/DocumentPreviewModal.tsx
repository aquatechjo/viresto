'use client'

import { useLocale } from '@/lib/useLocale'

type Locale = 'ar' | 'en'

interface Props {
  open: boolean
  onClose: () => void
  fileUrl: string
  fileType: string
  fileName: string
  documentId: string
  aiSummary?: string | null
  aiKeyPoints?: string[] | null
  aiParties?: string[] | null
  aiDates?: string[] | null
  aiAmounts?: string[] | null
  locale?: Locale
}

const COPY = {
  ar: {
    close: 'إغلاق',
    pdfUnavailable: 'تعذر عرض PDF داخل النظام',
    pdfHint: 'يمكنك فتح الملف في تبويب جديد أو تحميله.',
    openNewTab: 'فتح في تبويب جديد',
    downloadFile: 'تحميل الملف',
    unsupportedPreview: 'المعاينة غير مدعومة لهذا النوع',
    aiTitle: 'تحليل المستند AI',
    summary: 'الملخص',
    keyPoints: 'النقاط الرئيسية',
    parties: 'الأطراف',
    dates: 'التواريخ',
    amounts: 'المبالغ',
    noAnalysis: 'لم يتم تحليل هذا المستند بعد.',
  },
  en: {
    close: 'Close',
    pdfUnavailable: 'PDF preview is not available inside the system',
    pdfHint: 'You can open the file in a new tab or download it.',
    openNewTab: 'Open in new tab',
    downloadFile: 'Download file',
    unsupportedPreview: 'Preview is not supported for this file type',
    aiTitle: 'AI document analysis',
    summary: 'Summary',
    keyPoints: 'Key points',
    parties: 'Parties',
    dates: 'Dates',
    amounts: 'Amounts',
    noAnalysis: 'This document has not been analyzed yet.',
  },
} as const

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
  const localeState = useLocale() as { locale?: Locale }
  const locale: Locale = localeProp ?? (localeState?.locale === 'en' ? 'en' : 'ar')
  const isRtl = locale === 'ar'
  const t = COPY[locale]

  if (!open) return null

  const isImage = fileType.startsWith('image/')
  const isPdf = fileType === 'application/pdf'
  const previewUrl = `/api/documents/${documentId}/preview`

  const chipAlign = isRtl ? 'justify-end' : 'justify-start'

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="h-[90vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] text-[var(--text-1)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <h2 className="truncate text-sm font-bold">{fileName}</h2>

          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            title={t.close}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500 text-white transition hover:bg-red-600"
          >
            ✕
          </button>
        </div>

        <div className="grid h-[calc(90vh-73px)] grid-cols-1 md:grid-cols-[1.4fr_.8fr]">
          <div className="flex min-h-0 items-center justify-center bg-black">
            {isImage && (
              <img
                src={fileUrl}
                alt={fileName}
                className="max-h-full max-w-full object-contain"
              />
            )}

            {isPdf && (
              <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-black p-6 text-center text-white">
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
                    href={previewUrl}
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
          </div>

          <aside className="min-h-0 overflow-y-auto border-t border-[var(--border)] bg-[var(--surface)] p-5 text-start md:border-t-0 md:border-l">
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
                      {aiKeyPoints.map((item, i) => (
                        <li key={i}>• {item}</li>
                      ))}
                    </ul>
                  </section>
                )}

                {!!aiParties?.length && (
                  <section>
                    <h4 className="mb-2 font-bold text-[var(--text-1)]">
                      {t.parties}
                    </h4>
                    <div className={`flex flex-wrap gap-2 ${chipAlign}`}>
                      {aiParties.map((item, i) => (
                        <span
                          key={i}
                          className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs text-[var(--text-2)]"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {!!aiDates?.length && (
                  <section>
                    <h4 className="mb-2 font-bold text-[var(--text-1)]">
                      {t.dates}
                    </h4>
                    <div className={`flex flex-wrap gap-2 ${chipAlign}`}>
                      {aiDates.map((item, i) => (
                        <span
                          key={i}
                          className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs text-[var(--text-2)]"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {!!aiAmounts?.length && (
                  <section>
                    <h4 className="mb-2 font-bold text-[var(--text-1)]">
                      {t.amounts}
                    </h4>
                    <div className={`flex flex-wrap gap-2 ${chipAlign}`}>
                      {aiAmounts.map((item, i) => (
                        <span
                          key={i}
                          className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs text-[var(--text-2)]"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-5 text-center">
                <p className="text-sm text-[var(--text-3)]">{t.noAnalysis}</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
