import { err } from '@/lib/api-response'

export async function POST() {
  return err('ميزة رفع الشعار غير مفعلة حالياً', 410)
}

export async function DELETE() {
  return err('ميزة حذف الشعار غير مفعلة حالياً', 410)
}