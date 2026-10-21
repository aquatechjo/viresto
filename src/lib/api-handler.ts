import { Prisma } from '@prisma/client'
import { err } from '@/lib/api-response'
import { RateLimitUnavailableError } from '@/lib/rate-limit'
import { reportError } from '@/lib/monitoring'

// The answer when the rate-limit store is down (production fails closed).
// Also used by routes that handle their own errors instead of apiHandler.
export function rateLimitUnavailableResponse() {
  console.error('[API_RATE_LIMIT_UNAVAILABLE] Request blocked safely.')
  return err('خدمة الحماية غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.', 503)
}

export async function apiHandler(handler: () => Promise<Response>) {
  try {
    return await handler()
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return rateLimitUnavailableResponse()
    }

    console.error('[API_ERROR]', error)
    reportError(error, { handler: 'apiHandler' })

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return err('تعذر الاتصال بقاعدة البيانات. حاول مرة أخرى بعد قليل.', 503)
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return err('تعذر تنفيذ العملية على قاعدة البيانات.', 500)
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return err('طلب غير صالح لقاعدة البيانات.', 400)
    }

    return err('حدث خطأ غير متوقع. حاول مرة أخرى.', 500)
  }
}
