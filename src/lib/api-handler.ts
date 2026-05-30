import { NextResponse } from 'next/server'

export async function apiHandler<T>(
  fn: () => Promise<Response>
): Promise<Response> {
  try {
    return await fn()
  } catch (error: any) {
    console.error('[API_ERROR]', error)

    const message =
      process.env.NODE_ENV === 'production'
        ? 'حدث خطأ غير متوقع'
        : error?.message || 'حدث خطأ غير متوقع'

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    )
  }
}