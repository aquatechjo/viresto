import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey() {
  const key = process.env.ENCRYPTION_KEY

  if (!key) {
    throw new Error('ENCRYPTION_KEY is missing')
  }

  const buffer = Buffer.from(key, 'base64')

  if (buffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY must decode to exactly 32 bytes')
  }

  return buffer
}

export function encryptText(value?: string | null) {
  if (!value) return value

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)

  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ])

  const tag = cipher.getAuthTag()

  return [
    'enc',
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

export function decryptText(value?: string | null) {
  if (!value) return value
  if (!value.startsWith('enc:')) return value

  const [, ivRaw, tagRaw, encryptedRaw] = value.split(':')

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivRaw, 'base64')
  )

  decipher.setAuthTag(Buffer.from(tagRaw, 'base64'))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64')),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}

export function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null
}

export function normalizePhone(value?: string | null) {
  if (!value) return null
  return value.replace(/[^\d+]/g, '').trim() || null
}

export function hashSearchValue(value?: string | null) {
  if (!value) return null

  const secret = process.env.SEARCH_HASH_SECRET

  if (!secret) {
    throw new Error('SEARCH_HASH_SECRET is required')
  }

  return crypto
    .createHmac('sha256', secret)
    .update(value)
    .digest('hex')
}