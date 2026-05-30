import { useEffect, useState } from 'react'

export function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        setLoading(true)

        const res = await fetch(url)
        const json = await res.json()

        if (!active) return

        setData(json.data)
        setError(null)
      } catch (e) {
        if (!active) return
        setError('حدث خطأ')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      active = false
    }
  }, [url])

  return {
    data,
    loading,
    error,
  }
}