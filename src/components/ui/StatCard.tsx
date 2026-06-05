interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  color?: string
  bg?: string
}

export default function StatCard({ label, value, sub, color, bg }: StatCardProps) {
  const valueText = String(value)
  const isLongValue = valueText.length > 7

  return (
    <div className="card p-5" style={{ background: bg ?? 'var(--card)' }}>
      <p
        className="mb-1 text-xs font-semibold"
        style={{ color: color ?? 'var(--text-3)' }}
      >
        {label}
      </p>

      <p
        className={`
          truncate font-black leading-tight
          ${isLongValue ? 'text-xl' : 'text-2xl'}
        `}
        style={{ color: color ?? 'var(--text)' }}
      >
        {value}
      </p>

      {sub && (
        <p
          className="mt-1.5 text-xs font-medium"
          style={{ color: color ? color + '99' : 'var(--text-3)' }}
        >
          {sub}
        </p>
      )}
    </div>
  )
}