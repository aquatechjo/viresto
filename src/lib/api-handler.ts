import { Prisma } from '@prisma/client'
import { err } from '@/lib/api-response'
import { RateLimitUnavailableError } from '@/lib/rate-limit'

export async function apiHandler(handler: () => Promise<Response>) {
  try {
    return await handler()
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      console.error('[API_RATE_LIMIT_UNAVAILABLE] Request blocked safely.')
      return err('خدمة الحماية غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.', 503)
    }

    console.error('[API_ERROR]', error)

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
