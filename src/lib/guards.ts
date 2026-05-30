import { NextRequest } from 'next/server'
import { err } from '@/lib/api-response'
import { requireRole } from '@/lib/api-auth'


export async function adminGuard(req: NextRequest) {
  const auth = await requireRole(req, ['ADMIN'])

  if (auth.error || !auth.user) {
    return {
      error: auth.error || err('غير مصرح', 403),
      user: null,
    }
  }

  return {
    error: null,
    user: auth.user,
  }
}

export async function staffGuard(req: NextRequest) {
  const auth = await requireRole(req, [
    'ADMIN',
    'LAWYER',
    'STAFF',
  ])

  if (auth.error || !auth.user) {
    return {
      error: auth.error || err('غير مصرح', 403),
      user: null,
    }
  }

  return {
    error: null,
    user: auth.user,
  }
}

export async function lawyerGuard(req: NextRequest) {
  const auth = await requireRole(req, [
    'ADMIN',
    'LAWYER',
  ])

  if (auth.error || !auth.user) {
    return {
      error: auth.error || err('غير مصرح', 403),
      user: null,
    }
  }

  return {
    error: null,
    user: auth.user,
  }
}