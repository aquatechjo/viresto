'use client'

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
}

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
}: Props) {
  if (!open) return null

  const isImage = fileType.startsWith('image/')
  const isPdf = fileType === 'application/pdf'
  const previewUrl = `/api/documents/${documentId}/preview`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="h-[90vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-sm font-bold">{fileName}</h2>

          <button
            onClick={onClose}
            className="h-10 w-10 rounded-xl bg-red-500 text-white"
          >
            ✕
          </button>
        </div>

        <div className="grid h-[calc(90vh-73px)] grid-cols-1 md:grid-cols-[1.4fr_.8fr]">
          <div className="flex items-center justify-center bg-black">
            {isImage && (
              <img
                src={fileUrl}
                alt={fileName}
                className="max-h-full max-w-full object-contain"
              />
            )}

{isPdf && (
  <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-black text-white">
    <p className="text-lg font-bold">تعذر عرض PDF داخل النظام</p>
    <p className="text-sm text-white/70">
      يمكنك فتح الملف في تبويب جديد أو تحميله.
    </p>

    <div className="flex gap-3">
      <a
        href={previewUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-xl bg-green-700 px-4 py-2 text-sm text-white"
      >
        فتح في تبويب جديد
      </a>

      <a
        href={previewUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-xl bg-white px-4 py-2 text-sm text-black"
      >
        تحميل الملف
      </a>
    </div>
  </div>
)}

            {!isImage && !isPdf && (
              <div className="text-sm text-white">
                Preview غير مدعوم لهذا النوع
              </div>
            )}
          </div>

          <aside className="overflow-y-auto border-r border-[var(--border)] bg-white p-5 text-right">
            <h3 className="mb-4 text-lg font-bold text-slate-900">
              تحليل المستند AI
            </h3>

            {aiSummary ? (
              <div className="space-y-5">
                <section>
                  <h4 className="mb-2 font-bold text-green-700">الملخص</h4>
                  <p className="text-sm leading-7 text-slate-700">
                    {aiSummary}
                  </p>
                </section>

                {!!aiKeyPoints?.length && (
                  <section>
                    <h4 className="mb-2 font-bold text-slate-900">
                      النقاط الرئيسية
                    </h4>
                    <ul className="space-y-2 text-sm text-slate-700">
                      {aiKeyPoints.map((item, i) => (
                        <li key={i}>• {item}</li>
                      ))}
                    </ul>
                  </section>
                )}

                {!!aiParties?.length && (
                  <section>
                    <h4 className="mb-2 font-bold text-slate-900">الأطراف</h4>
                    <div className="flex flex-wrap justify-end gap-2">
                      {aiParties.map((item, i) => (
                        <span key={i} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                          {item}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {!!aiDates?.length && (
                  <section>
                    <h4 className="mb-2 font-bold text-slate-900">التواريخ</h4>
                    <div className="flex flex-wrap justify-end gap-2">
                      {aiDates.map((item, i) => (
                        <span key={i} className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
                          {item}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {!!aiAmounts?.length && (
                  <section>
                    <h4 className="mb-2 font-bold text-slate-900">المبالغ</h4>
                    <div className="flex flex-wrap justify-end gap-2">
                      {aiAmounts.map((item, i) => (
                        <span key={i} className="rounded-full bg-green-50 px-3 py-1 text-xs text-green-700">
                          {item}
                        </span>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-center">
                <p className="text-sm text-slate-500">
                  لم يتم تحليل هذا المستند بعد.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}