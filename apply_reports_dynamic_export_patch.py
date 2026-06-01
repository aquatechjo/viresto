from pathlib import Path

PAGE = Path("src/app/dashboard/reports/page.tsx")

if not PAGE.exists():
    raise SystemExit("❌ الملف غير موجود: src/app/dashboard/reports/page.tsx")

text = PAGE.read_text(encoding="utf-8")

# Remove static import that pulls jsPDF/xlsx into the reports bundle
text = text.replace("import { exportReportPDF, exportSheetsExcel } from '@/lib/export'\n", "")
text = text.replace("import { exportSheetsExcel, exportReportPDF } from '@/lib/export'\n", "")

# Make Excel export async and dynamically import heavy libraries only on click
text = text.replace(
"""  function exportFullExcel() {
    if (!data) return

    exportSheetsExcel(reportFilename(), [""",
"""  async function exportFullExcel() {
    if (!data) return

    const { exportSheetsExcel } = await import('@/lib/export')

    exportSheetsExcel(reportFilename(), ["""
)

# Make PDF export async and dynamically import heavy libraries only on click
text = text.replace(
"""  function exportFullPdf() {
    if (!data) return

    exportReportPDF(reportFilename(), reportTitle(), summaryRows(), [""",
"""  async function exportFullPdf() {
    if (!data) return

    const { exportReportPDF } = await import('@/lib/export')

    exportReportPDF(reportFilename(), reportTitle(), summaryRows(), ["""
)

# Guard in case the exact text was not found
if "await import('@/lib/export')" not in text:
    raise SystemExit("❌ لم أستطع تطبيق التحسين تلقائيًا. ابعث آخر نسخة من src/app/dashboard/reports/page.tsx")

PAGE.write_text(text, encoding="utf-8")

print("✅ تم تحويل تصدير PDF/Excel إلى dynamic import")
print("الآن شغّل:")
print("npm run build")
