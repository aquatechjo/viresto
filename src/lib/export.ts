import ExcelJS from 'exceljs'
import { themeTokens } from './theme/tokens'

// The Excel export of the finance reports page (several sheets in one
// workbook). Printed reports and PDFs are src/lib/reports (the browser's
// print dialog); jsPDF and its Amiri font were removed on 2026-11-13.

// Exports are always light: the app's light palette (color plan, batch 3).
const EXCEL_HEADER_FILL = 'FF' + themeTokens.light.sidebar.slice(1).toUpperCase()

function styleExcelHeader(worksheet: ExcelJS.Worksheet) {
  const header = worksheet.getRow(1)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_HEADER_FILL } }
}

export async function exportSheetsExcel(
  filename: string,
  sheets: { name: string; rows: Record<string, unknown>[] }[]
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

    styleExcelHeader(worksheet)

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
