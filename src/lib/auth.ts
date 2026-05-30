import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

export interface JWTPayload {
  userId: string
  tenantId: string
  email: string
  name: string
  role: string
  sessionId?: string
  isSystemAdmin?: boolean
}

export const COOKIE = 'ld_token'
const TTL_SEC = 60 * 60 * 24 * 7

const secret = () => {
  const value = process.env.JWT_SECRET

  if (!value) {
    throw new Error('JWT_SECRET is required')
  }

  return new TextEncoder().encode(value)
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SEC}s`)
    .sign(secret())
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value

  if (!token) return null

  return verifyToken(token)
}

export function buildCookie(token: string) {
  return {
    name: COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: TTL_SEC,
  }
}

export function clearCookie() {
  return {
    name: COOKIE,
    value: '',
    maxAge: 0,
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  }
}