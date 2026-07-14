'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  Tooltip,
} from 'recharts'

export default function RevenueChart() {
  const [data, setData] = useState<any[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    async function loadRevenue() {
      try {
        const r = await fetch('/api/analytics/revenue')

        if (!r.ok) {
          setData([])
          return
        }

        const d = await r.json().catch(() => ({ data: [] }))

        setData(Array.isArray(d.data) ? d.data : [])
      } catch {
        setData([])
      }
    }

    loadRevenue()
  }, [])

  return (
    <div className="card p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p
            className="text-sm font-bold"
            style={{ color: 'var(--text)' }}
          >
            الإيرادات
          </p>

          <p
            className="mt-1 text-xs"
            style={{ color: 'var(--text-3)' }}
          >
            آخر 6 أشهر
          </p>
        </div>
      </div>

      <div className="h-[260px] min-h-[260px] w-full min-w-0">
        {!mounted ? (
          <div className="h-full w-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#b87333" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#b87333" stopOpacity={0} />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                fontSize={12}
              />

              <Tooltip />

              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#b87333"
                strokeWidth={3}
                fill="url(#rev)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
