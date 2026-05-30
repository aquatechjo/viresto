'use client'

import { useEffect, useState } from 'react'

type SessionUser = {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'LAWYER' | 'STAFF'

  tenant?: {
    id: string
    name: string
    slug: string
    plan: string
  }
}

export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        setUser(d.data ?? null)
      })
      .catch(() => {
        setUser(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  return {
    user,
    loading,
    isAdmin: user?.role === 'ADMIN',
    isLawyer: user?.role === 'LAWYER',
    isStaff: user?.role === 'STAFF',
  }
}