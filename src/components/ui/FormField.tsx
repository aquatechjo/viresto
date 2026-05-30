interface Props {
  label:       string
  required?:   boolean
  error?:      string
  children:    React.ReactNode
}

export default function FormField({ label, required, error, children }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
        {label}{required && <span className="text-red-500 mr-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
