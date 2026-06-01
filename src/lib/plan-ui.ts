export function getApiMessage(data: any, fallback = 'حدث خطأ غير متوقع') {
  if (!data) return fallback

  if (data.message) return data.message
  if (data.error) return data.error
  if (data.details?.message) return data.details.message
  if (data.data?.message) return data.data.message

  const formErrors = data.details?.formErrors
  if (Array.isArray(formErrors) && formErrors.length > 0) {
    return formErrors.join(' | ')
  }

  const fieldErrors = data.details?.fieldErrors
  if (fieldErrors && typeof fieldErrors === 'object') {
    const messages = Object.values(fieldErrors)
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .filter((value): value is string => typeof value === 'string' && value.length > 0)

    if (messages.length > 0) {
      return messages.join(' | ')
    }
  }

  return fallback
}

export function isPlanLimitResponse(data: any) {
  const code = String(data?.code || data?.errorCode || data?.data?.code || '').toUpperCase()
  const message = String(getApiMessage(data, '')).toLowerCase()

  return (
    code.includes('PLAN') ||
    code.includes('LIMIT') ||
    message.includes('الخطة') ||
    message.includes('الاشتراك') ||
    message.includes('الحد') ||
    message.includes('ترقية') ||
    message.includes('limit') ||
    message.includes('plan') ||
    message.includes('upgrade')
  )
}

export function planLimitMessage(data: any, fallback = 'وصلت إلى حد الخطة الحالية. قم بترقية الاشتراك للمتابعة.') {
  return getApiMessage(data, fallback)
}