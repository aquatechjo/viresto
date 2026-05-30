interface Entry {
  count: number
  resetAt: number
}

const store = new Map<string, Entry>()

type RateLimitOptions = {
  windowMs?: number
  max?: number
  keyPrefix?: string
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions = {}
): { allowed: boolean; remaining: number; resetAt: number } {
  const windowMs = options.windowMs ?? 15 * 60 * 1000
  const max = options.max ?? 20
  const prefix = options.keyPrefix ?? 'rl'

  const now = Date.now()
  const mapKey = `${prefix}:${key}`

  let entry = store.get(mapKey)

  if (!entry || now > entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + windowMs,
    }

    store.set(mapKey, entry)
  }

  entry.count++

  return {
    allowed: entry.count <= max,
    remaining: Math.max(0, max - entry.count),
    resetAt: entry.resetAt,
  }
}