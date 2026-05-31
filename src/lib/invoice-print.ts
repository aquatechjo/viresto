export type PrintableInvoiceStatus = 'DRAFT' | 'UNPAID' | 'PAID' | 'OVERDUE' | 'CANCELLED'

export type PrintableInvoice = {
  id: string
  invoiceNumber: string
  status: PrintableInvoiceStatus
  issueDate: string
  dueDate?: string | null
  subtotal: number
  tax: number
  discount: number
  total: number
  notes?: string | null
  client: {
    id?: string
    name?: string | null
    phone?: string | null
    email?: string | null
  }
  case?: {
    id?: string
    title?: string | null
    caseNumber?: string | null
  } | null
  items: Array<{
    id?: string
    description: string
    quantity: number
    unitPrice: number
    total?: number
  }>
  payment?: {
    id?: string
    amount?: number
    status?: string
    paidAt?: string | null
  } | null
  tenant?: {
    id?: string
    name?: string | null
    email?: string | null
    phone?: string | null
    address?: string | null
    logoUrl?: string | null
  } | null
}

export const invoiceStatusLabels: Record<PrintableInvoiceStatus, string> = {
  DRAFT: 'مسودة',
  UNPAID: 'غير مدفوعة',
  PAID: 'مدفوعة',
  OVERDUE: 'متأخرة',
  CANCELLED: 'ملغاة',
}

export function formatInvoiceNumber(invoiceNumber?: string | null) {
  if (!invoiceNumber) return '#INV'
  return invoiceNumber.startsWith('#') ? invoiceNumber : `#${invoiceNumber}`
}

export function safeInvoiceFilename(invoiceNumber?: string | null) {
  const clean = (invoiceNumber || 'invoice')
    .replace(/^#/, '')
    .replace(/[^a-zA-Z0-9\-_\u0600-\u06FF]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return clean || 'invoice'
}

export function normalizeWhatsAppPhone(phone?: string | null) {
  if (!phone) return ''

  const cleaned = phone.replace(/[^\d+]/g, '')

  if (cleaned.startsWith('+')) return cleaned.replace('+', '')
  if (cleaned.startsWith('00')) return cleaned.slice(2)
  if (cleaned.startsWith('0')) return `962${cleaned.slice(1)}`

  return cleaned
}

function money(value?: number | null) {
  return new Intl.NumberFormat('ar-JO', {
    style: 'currency',
    currency: 'JOD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function date(value?: string | Date | null) {
  if (!value) return '-'

  try {
    return new Intl.DateTimeFormat('ar-JO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(value))
  } catch {
    return '-'
  }
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function buildInvoiceWhatsAppMessage(invoice: PrintableInvoice) {
  const tenantName = invoice.tenant?.name || 'Viresto'
  const caseText = invoice.case
    ? `${invoice.case.title || '-'}${invoice.case.caseNumber ? ` - ${invoice.case.caseNumber}` : ''}`
    : 'بدون قضية'

  return `مرحبًا ${invoice.client?.name || ''}

نرسل لكم تفاصيل الفاتورة:

رقم الفاتورة: ${formatInvoiceNumber(invoice.invoiceNumber)}
الحالة: ${invoiceStatusLabels[invoice.status]}
القضية: ${caseText}
تاريخ الإصدار: ${date(invoice.issueDate)}
تاريخ الاستحقاق: ${date(invoice.dueDate)}
الإجمالي: ${money(invoice.total)}

يرجى مراجعة الفاتورة، ولأي استفسار يمكنكم التواصل معنا.

مع التحية،
${tenantName}`.trim()
}

export function buildInvoicePrintHtml(invoice: PrintableInvoice) {
  const tenant = invoice.tenant
  const tenantName = tenant?.name || 'Viresto'
  const tenantEmail = tenant?.email || 'Legal SaaS Platform'
  const tenantPhone = tenant?.phone || ''
  const tenantAddress = tenant?.address || ''
  const invoiceNo = formatInvoiceNumber(invoice.invoiceNumber)
  const caseText = invoice.case
    ? `${invoice.case.title || '-'}${invoice.case.caseNumber ? ` - ${invoice.case.caseNumber}` : ''}`
    : 'بدون قضية'

  const rows = invoice.items
    .map((item, index) => {
      const lineTotal = item.total ?? Number(item.quantity || 0) * Number(item.unitPrice || 0)
      return `
        <tr>
          <td class="center">${index + 1}</td>
          <td>${escapeHtml(item.description)}</td>
          <td class="center">${escapeHtml(item.quantity)}</td>
          <td>${money(item.unitPrice)}</td>
          <td class="strong">${money(lineTotal)}</td>
        </tr>
      `
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>فاتورة ${escapeHtml(invoiceNo)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      background: #eef3f0;
      color: #10231d;
      direction: rtl;
      font-family: Tahoma, Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .paper {
      max-width: 900px;
      min-height: 1180px;
      margin: 0 auto;
      background: #fff;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 18px 50px rgba(16,35,29,.14);
      border: 1px solid #dfe9e4;
    }
    .hero {
      display: grid;
      grid-template-columns: 1.35fr .85fr;
      gap: 24px;
      padding: 34px 38px;
      color: #fff;
      background: linear-gradient(135deg, #12382d, #214f41);
    }
    .brand { display: flex; gap: 16px; align-items: center; }
    .logo {
      width: 72px;
      height: 72px;
      border-radius: 18px;
      background: rgba(255,255,255,.14);
      border: 1px solid rgba(255,255,255,.25);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      font-size: 28px;
      font-weight: 900;
    }
    .logo img { width: 100%; height: 100%; object-fit: contain; padding: 8px; }
    h1, h2, h3, p { margin: 0; }
    .brand h1 { font-size: 28px; font-weight: 900; }
    .brand p { margin-top: 7px; color: rgba(255,255,255,.78); font-size: 13px; line-height: 1.8; }
    .meta { text-align: left; align-self: start; }
    .meta h2 { font-size: 34px; font-weight: 900; letter-spacing: -.5px; }
    .pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-top: 12px;
      padding: 8px 14px;
      border-radius: 999px;
      background: rgba(255,255,255,.14);
      border: 1px solid rgba(255,255,255,.24);
      font-weight: 800;
      font-size: 12px;
    }
    .content { padding: 32px 38px; }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .summary-card {
      border: 1px solid #dfe9e4;
      border-radius: 18px;
      padding: 14px;
      background: #fbfdfc;
    }
    .label { color: #668075; font-size: 11px; font-weight: 800; margin-bottom: 8px; }
    .value { font-size: 14px; font-weight: 900; line-height: 1.7; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .box {
      border: 1px solid #dfe9e4;
      border-radius: 20px;
      padding: 18px;
      background: #fbfdfc;
      min-height: 132px;
    }
    .box h3 { font-size: 15px; font-weight: 900; margin-bottom: 12px; color: #12382d; }
    .muted { color: #668075; font-size: 12px; line-height: 1.8; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; overflow: hidden; border: 1px solid #dfe9e4; border-radius: 18px; }
    th { background: #edf6f1; color: #12382d; font-size: 12px; padding: 13px; text-align: right; border-bottom: 1px solid #dfe9e4; }
    td { padding: 13px; font-size: 12.5px; border-bottom: 1px solid #edf2ef; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    .center { text-align: center; }
    .strong { font-weight: 900; }
    .bottom { display: grid; grid-template-columns: 1fr 340px; gap: 20px; margin-top: 24px; align-items: start; }
    .notes { border: 1px dashed #cbd9d3; border-radius: 18px; padding: 16px; background: #fbfdfc; min-height: 134px; }
    .notes h3 { color: #12382d; font-size: 14px; margin-bottom: 10px; }
    .notes p { color: #40564e; font-size: 12px; line-height: 2; white-space: pre-wrap; }
    .totals { border: 1px solid #dfe9e4; border-radius: 20px; padding: 16px; background: #fbfdfc; }
    .total-row { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; color: #40564e; font-size: 13px; border-bottom: 1px solid #e8f0ec; }
    .total-row:last-child { border-bottom: none; }
    .grand { margin-top: 6px; padding-top: 16px; color: #12382d; font-weight: 900; font-size: 20px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 32px; }
    .signature { border-top: 1px solid #cbd9d3; padding-top: 10px; color: #668075; font-size: 12px; text-align: center; }
    .footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid #edf2ef; display: flex; justify-content: space-between; gap: 12px; color: #668075; font-size: 11px; }
    @media print {
      body { background: #fff; padding: 0; }
      .paper { box-shadow: none; border: none; border-radius: 0; min-height: auto; }
      .hero { border-radius: 0; }
      @page { size: A4; margin: 10mm; }
    }
  </style>
</head>
<body>
  <main class="paper">
    <section class="hero">
      <div class="brand">
        <div class="logo">
          ${tenant?.logoUrl ? `<img src="${escapeHtml(tenant.logoUrl)}" alt="${escapeHtml(tenantName)}" />` : escapeHtml(tenantName.slice(0, 1))}
        </div>
        <div>
          <h1>${escapeHtml(tenantName)}</h1>
          <p>${escapeHtml(tenantEmail)}${tenantPhone ? `<br/>${escapeHtml(tenantPhone)}` : ''}${tenantAddress ? `<br/>${escapeHtml(tenantAddress)}` : ''}</p>
        </div>
      </div>

      <div class="meta">
        <h2>فاتورة</h2>
        <div class="pill">${escapeHtml(invoiceNo)}</div>
        <p style="margin-top:12px;color:rgba(255,255,255,.82);font-size:13px;">${escapeHtml(invoiceStatusLabels[invoice.status])}</p>
      </div>
    </section>

    <section class="content">
      <div class="summary">
        <div class="summary-card"><div class="label">رقم الفاتورة</div><div class="value">${escapeHtml(invoiceNo)}</div></div>
        <div class="summary-card"><div class="label">تاريخ الإصدار</div><div class="value">${date(invoice.issueDate)}</div></div>
        <div class="summary-card"><div class="label">تاريخ الاستحقاق</div><div class="value">${date(invoice.dueDate)}</div></div>
        <div class="summary-card"><div class="label">الإجمالي</div><div class="value">${money(invoice.total)}</div></div>
      </div>

      <div class="two-col">
        <div class="box">
          <h3>بيانات الموكل</h3>
          <div class="value">${escapeHtml(invoice.client?.name || '-')}</div>
          <div class="muted">${escapeHtml(invoice.client?.phone || '-')}</div>
          <div class="muted">${escapeHtml(invoice.client?.email || '-')}</div>
        </div>
        <div class="box">
          <h3>بيانات القضية</h3>
          <div class="value">${escapeHtml(caseText)}</div>
          <div class="muted">الحالة المالية: ${escapeHtml(invoiceStatusLabels[invoice.status])}</div>
          <div class="muted">${invoice.payment ? 'مرتبطة بدفعة' : 'لا توجد دفعة مرتبطة'}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:52px;text-align:center;">#</th>
            <th>الوصف</th>
            <th style="width:90px;text-align:center;">الكمية</th>
            <th style="width:140px;">سعر الوحدة</th>
            <th style="width:150px;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="bottom">
        <div class="notes">
          <h3>ملاحظات</h3>
          <p>${escapeHtml(invoice.notes || 'لا توجد ملاحظات إضافية.')}</p>
        </div>
        <div class="totals">
          <div class="total-row"><span>المجموع الفرعي</span><strong>${money(invoice.subtotal)}</strong></div>
          <div class="total-row"><span>الضريبة</span><strong>${money(invoice.tax)}</strong></div>
          <div class="total-row"><span>الخصم</span><strong>${money(invoice.discount)}</strong></div>
          <div class="total-row grand"><span>الإجمالي النهائي</span><span>${money(invoice.total)}</span></div>
        </div>
      </div>

      <div class="signatures">
        <div class="signature">توقيع المكتب</div>
        <div class="signature">توقيع الموكل</div>
      </div>

      <div class="footer">
        <span>تم إنشاء هذه الفاتورة بواسطة Viresto</span>
        <span>${escapeHtml(invoiceNo)}</span>
      </div>
    </section>
  </main>
  <script>window.onload = function () { window.print() }</script>
</body>
</html>`
}

export function printInvoiceDocument(invoice: PrintableInvoice) {
  const printWindow = window.open('', '_blank', 'width=1000,height=800')

  if (!printWindow) {
    alert('يرجى السماح بفتح النوافذ المنبثقة لطباعة الفاتورة')
    return
  }

  printWindow.document.open()
  printWindow.document.write(buildInvoicePrintHtml(invoice))
  printWindow.document.close()
}
