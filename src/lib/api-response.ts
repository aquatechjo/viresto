import { NextResponse } from 'next/server'

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function err(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ success: false, message, ...(details ? { details } : {}) }, { status })
}

export function unauthorized(message = 'غير مصرح') {
  return NextResponse.json({ success: false, message }, { status: 401 })
}

export function notFound(message = 'غير موجود') {
  return NextResponse.json({ success: false, message }, { status: 404 })
}

export function serverError(message = 'خطأ في الخادم') {
  return NextResponse.json({ success: false, message }, { status: 500 })
}
