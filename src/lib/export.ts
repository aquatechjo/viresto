import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'
import { amiriFont } from './fonts/amiri-font'

export function exportToCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return

  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`)
        .join(',')
    ),
  ].join('\n')

  const blob = new Blob(['\uFEFF' + csv], {
    type: 'text/csv;charset=utf-8;',
  })

  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}.csv`
  link.click()
}

export async function exportToExcel(filename: string, rows: Record<string, any>[]) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Report')

  if (!rows.length) {
    worksheet.addRow(['لا توجد بيانات'])
  } else {
    const columns = Object.keys(rows[0])

    worksheet.columns = columns.map((key) => ({
      header: key,
      key,
      width: 20,
    }))

    rows.forEach((row) => {
      worksheet.addRow(row)
    })

    worksheet.getRow(1).font = { bold: true }

    worksheet.columns.forEach((column) => {
      let maxLength = 12

      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const value = cell.value ? String(cell.value) : ''
        maxLength = Math.max(maxLength, value.length)
      })

      column.width = Math.min(Math.max(maxLength + 2, 12), 40)
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()

  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  window.URL.revokeObjectURL(url)
}

export function exportToPDF(
  filename: string,
  title: string,
  columns: string[],
  rows: any[][]
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  })

  doc.setFontSize(18)
  doc.text(title, 40, 40)

  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: 65,
    styles: {
      fontSize: 11,
      cellPadding: 8,
      minCellHeight: 22,
    },
    headStyles: {
      fillColor: [45, 74, 62],
      textColor: 255,
    },
  })

  doc.save(`${filename}.pdf`)
}


export async function exportSheetsToExcel(
  filename: string,
  sheets: { name: string; rows: Record<string, any>[] }[]
) {
  const workbook = new ExcelJS.Workbook()

  sheets.forEach((sheet) => {
    const safeName = sheet.name.slice(0, 31) || 'Report'
    const worksheet = workbook.addWorksheet(safeName)

    if (!sheet.rows.length) {
      worksheet.addRow(['لا توجد بيانات'])
      return
    }

    const columns = Object.keys(sheet.rows[0])

    worksheet.columns = columns.map((key) => ({
      header: key,
      key,
      width: 20,
    }))

    sheet.rows.forEach((row) => {
      worksheet.addRow(row)
    })

    worksheet.getRow(1).font = { bold: true }

    worksheet.columns.forEach((column) => {
      let maxLength = 12

      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const value = cell.value ? String(cell.value) : ''
        maxLength = Math.max(maxLength, value.length)
      })

      column.width = Math.min(Math.max(maxLength + 2, 12), 40)
    })
  })

  const buffer = await workbook.xlsx.writeBuffer()

  const blob = new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  window.URL.revokeObjectURL(url)
}

export function exportReportPDF(
  filename: string,
  title: string,
  summaryRows: any[][],
  tables: { title: string; columns: string[]; rows: any[][] }[]
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  })

  doc.addFileToVFS('Amiri-Regular.ttf', amiriFont)
  doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal')
  doc.setFont('Amiri', 'normal')
  ;(doc as any).setR2L?.(true)

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  doc.setTextColor(45, 74, 62)
  doc.setFontSize(20)
  doc.text('Viresto', pageWidth / 2, 38, { align: 'center' })

  doc.setTextColor(0)
  doc.setFontSize(14)
  doc.text(title, pageWidth / 2, 64, { align: 'center' })

  autoTable(doc, {
    startY: 88,
    head: [['القيمة', 'البند']],
    body: summaryRows.map((row) => [row[1] ?? '-', row[0] ?? '-']),
    theme: 'grid',
    styles: {
      font: 'Amiri',
      fontStyle: 'normal',
      halign: 'right',
      fontSize: 10,
      cellPadding: 7,
      minCellHeight: 22,
    },
    headStyles: {
      font: 'Amiri',
      fontStyle: 'normal',
      fillColor: [45, 74, 62],
      textColor: 255,
      halign: 'right',
    },
  })

  let y = ((doc as any).lastAutoTable?.finalY || 110) + 22

  tables.forEach((table) => {
    const body = table.rows.length ? table.rows : [table.columns.map(() => '-')]

    if (y > pageHeight - 120) {
      doc.addPage()
      doc.setFont('Amiri', 'normal')
      y = 45
    }

    doc.setFontSize(13)
    doc.setTextColor(45, 74, 62)
    doc.text(table.title, pageWidth - 40, y, { align: 'right' })

    autoTable(doc, {
      startY: y + 12,
      head: [table.columns],
      body,
      theme: 'grid',
      styles: {
        font: 'Amiri',
        fontStyle: 'normal',
        halign: 'right',
        fontSize: 9,
        cellPadding: 6,
        minCellHeight: 20,
        overflow: 'linebreak',
      },
      headStyles: {
        font: 'Amiri',
        fontStyle: 'normal',
        fillColor: [45, 74, 62],
        textColor: 255,
        halign: 'right',
      },
    })

    y = ((doc as any).lastAutoTable?.finalY || y) + 24
  })

  const pages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('Amiri', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(
      `Generated by Viresto - ${new Date().toLocaleDateString('ar-JO')} - صفحة ${i} من ${pages}`,
      pageWidth / 2,
      pageHeight - 20,
      { align: 'center' }
    )
  }

  doc.save(`${filename}.pdf`)
}


export function exportClientFullPDF(client: any) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  })

doc.addFileToVFS('Amiri-Regular.ttf', amiriFont)
doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal')
doc.setFont('Amiri', 'normal')

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  doc.setTextColor(45, 74, 62)
  doc.setFontSize(22)
  doc.text('Viresto', pageWidth / 2, 45, { align: 'center' })

  doc.setTextColor(0)
  doc.setFontSize(14)
  doc.text(`ملف الموكل - ${client.name || '-'}`, pageWidth / 2, 75, {
    align: 'center',
  })

  autoTable(doc, {
    startY: 105,
    head: [['البيان', 'القيمة']],
    body: [
      ['الاسم', client.name || '-'],
      ['الهاتف', client.phone || '-'],
      ['البريد', client.email || '-'],
      ['العنوان', client.address || '-'],
      ['رقم الهوية', client.nationalId || '-'],
      ['ملاحظات', client.notes || '-'],
    ],
    theme: 'grid',
    styles: {
      font: 'Amiri',
      fontStyle: 'normal',
      halign: 'right',
      fontSize: 11,
      cellPadding: 8,
      minCellHeight: 22,
    },
    headStyles: {
      font: 'Amiri',
      fontStyle: 'normal',
      fillColor: [45, 74, 62],
      textColor: 255,
      halign: 'right',
    },
  })

  let y = (doc as any).lastAutoTable.finalY + 25

  doc.setFontSize(13)
  doc.setTextColor(45, 74, 62)
  doc.text('القضايا', pageWidth - 40, y, { align: 'right' })

  autoTable(doc, {
    startY: y + 12,
    head: [['القضية', 'الحالة', 'المحكمة', 'الأتعاب']],
    body: (client.cases ?? []).length
      ? (client.cases ?? []).map((c: any) => [
          c.title || '-',
          c.status || '-',
          c.court || '-',
          c.feeAmount || 0,
        ])
      : [['لا توجد قضايا', '-', '-', '-']],
    theme: 'grid',
    styles: {
      font: 'Amiri',
      fontStyle: 'normal',
      halign: 'right',
      fontSize: 11,
      cellPadding: 8,
      minCellHeight: 22,
    },
    headStyles: {
      font: 'Amiri',
      fontStyle: 'normal',
      fillColor: [45, 74, 62],
      textColor: 255,
      halign: 'right',
    },
  })

  y = (doc as any).lastAutoTable.finalY + 25

  doc.setFontSize(13)
  doc.setTextColor(45, 74, 62)
  doc.text('المواعيد', pageWidth - 40, y, { align: 'right' })

  autoTable(doc, {
    startY: y + 12,
    head: [['الموعد', 'النوع', 'التاريخ', 'المكان']],
    body: (client.appointments ?? []).length
      ? (client.appointments ?? []).map((a: any) => [
          a.title || '-',
          a.type || '-',
          a.startTime ? new Date(a.startTime).toLocaleString('ar') : '-',
          a.location || '-',
        ])
      : [['لا توجد مواعيد', '-', '-', '-']],
    theme: 'grid',
    styles: {
      font: 'Amiri',
      fontStyle: 'normal',
      halign: 'right',
      fontSize: 11,
      cellPadding: 8,
      minCellHeight: 22,
    },
    headStyles: {
      font: 'Amiri',
      fontStyle: 'normal',
      fillColor: [45, 74, 62],
      textColor: 255,
      halign: 'right',
    },
  })

  y = (doc as any).lastAutoTable.finalY + 25

  doc.setFontSize(13)
  doc.setTextColor(45, 74, 62)
  doc.text('المدفوعات', pageWidth - 40, y, { align: 'right' })

  autoTable(doc, {
    startY: y + 12,
    head: [['ملاحظات', 'التاريخ', 'الحالة', 'المبلغ']],
    body: (client.payments ?? []).length
      ? (client.payments ?? []).map((p: any) => [
          p.notes || '-',
          p.createdAt ? new Date(p.createdAt).toLocaleDateString('ar') : '-',
          p.status || '-',
          p.amount || 0,
        ])
      : [['لا توجد مدفوعات', '-', '-', '-']],
    theme: 'grid',
    styles: {
      font: 'Amiri',
      fontStyle: 'normal',
      halign: 'right',
      fontSize: 11,
      cellPadding: 8,
      minCellHeight: 22,
    },
    headStyles: {
      font: 'Amiri',
      fontStyle: 'normal',
      fillColor: [45, 74, 62],
      textColor: 255,
      halign: 'right',
    },
  })

  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(
    `Generated by Viresto - ${new Date().toLocaleDateString('ar')}`,
    pageWidth / 2,
    pageHeight - 25,
    { align: 'center' }
  )

  doc.save(`client-${client.name || 'file'}.pdf`)
}

export const exportSheetsExcel = exportSheetsToExcel