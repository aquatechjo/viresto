interface Props {
  label:   string
  value:   string | number
  sub?:    string
  color?:  string   // CSS var name e.g. 'var(--sidebar)'
  bg?:     string
}

export default function StatCard({ label, value, sub, color, bg }: Props) {
  return (
    <div className="card p-5" style={{ background: bg ?? 'var(--card)' }}>
      <p className="text-xs font-semibold mb-1" style={{ color: color ?? 'var(--text-3)' }}>{label}</p>
      <p className="text-3xl font-black leading-none" style={{ color: color ?? 'var(--text)' }}>{value}</p>
      {sub && <p className="text-xs mt-1.5" style={{ color: color ? color + '99' : 'var(--text-3)' }}>{sub}</p>}
    </div>
  )
}
