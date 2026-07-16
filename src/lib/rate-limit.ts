import { createHash } from 'node:crypto'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

type RateLimitOptions = {
  windowMs?: number
  max?: number
  keyPrefix?: string
}

type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
}

export class RateLimitUnavailableError extends Error {
  constructor() {
    super('Distributed rate-limit storage is unavailable')
    this.name = 'RateLimitUnavailableError'
  }
}

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null

const localStore = new Map<string, { count: number; resetAt: number }>()

const limiters = new Map<string, Ratelimit>()

let warnedAboutLocalFallback = false
let reportedProductionFailure = false

export function hashRateLimitIdentifier(value: string) {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

function reportProductionFailure(message: string) {
  if (reportedProductionFailure) return

  reportedProductionFailure = true
  console.error(message)
}

function windowToDuration(windowMs: number): `${number} s` | `${number} m` | `${number} h` {
  const seconds = Math.ceil(windowMs / 1000)

  if (seconds % 3600 === 0) {
    return `${seconds / 3600} h`
  }

  if (seconds % 60 === 0) {
    return `${seconds / 60} m`
  }

  return `${seconds} s`
}

function getLimiter(prefix: string, max: number, windowMs: number) {
  const key = `${prefix}:${max}:${windowMs}`

  const existing = limiters.get(key)
  if (existing) return existing

  if (!redis) return null

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, windowToDuration(windowMs)),
    analytics: true,
    prefix,
  })

  limiters.set(key, limiter)

  return limiter
}

function checkLocalRateLimit(
  key: string,
  options: Required<RateLimitOptions>
): RateLimitResult {
  const now = Date.now()
  const mapKey = `${options.keyPrefix}:${key}`

  let entry = localStore.get(mapKey)

  if (!entry || now > entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + options.windowMs,
    }

    localStore.set(mapKey, entry)
  }

  entry.count++

  return {
    allowed: entry.count <= options.max,
    remaining: Math.max(0, options.max - entry.count),
    resetAt: entry.resetAt,
  }
}

export async function checkRateLimit(
  key: string,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const normalizedOptions: Required<RateLimitOptions> = {
    windowMs: options.windowMs ?? 15 * 60 * 1000,
    max: options.max ?? 20,
    keyPrefix: options.keyPrefix ?? 'rl',
  }

  // Never send raw IP addresses, emails, user IDs, or compound identifiers to Redis.
  const protectedKey = hashRateLimitIdentifier(key)

  const limiter = getLimiter(
    normalizedOptions.keyPrefix,
    normalizedOptions.max,
    normalizedOptions.windowMs
  )

  if (!limiter) {
    if (process.env.NODE_ENV === 'production') {
      reportProductionFailure(
        '[RATE_LIMIT_UNAVAILABLE] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production.'
      )
      throw new RateLimitUnavailableError()
    }

    if (!warnedAboutLocalFallback) {
      warnedAboutLocalFallback = true
      console.warn(
        'Upstash env vars are missing. Using an in-memory rate limit outside production.'
      )
    }

    return checkLocalRateLimit(protectedKey, normalizedOptions)
  }

  try {
    const result = await limiter.limit(protectedKey)

    return {
      allowed: result.success,
      remaining: result.remaining,
      resetAt: result.reset,
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      const errorName = error instanceof Error ? error.name : 'UnknownError'
      reportProductionFailure(
        `[RATE_LIMIT_UNAVAILABLE] Upstash request failed (${errorName}).`
      )
      throw new RateLimitUnavailableError()
    }

    if (!warnedAboutLocalFallback) {
      warnedAboutLocalFallback = true
      console.warn(
        'Upstash request failed. Using an in-memory rate limit outside production.'
      )
    }

    return checkLocalRateLimit(protectedKey, normalizedOptions)
  }
}
