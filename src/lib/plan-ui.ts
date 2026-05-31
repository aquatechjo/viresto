export function getApiMessage(data: any, fallback: string) {
  return data?.message || data?.error || data?.data?.message || fallback
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
