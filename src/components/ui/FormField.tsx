interface Props {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}

export default function FormField({ label, required, error, children }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-black text-slate-700 dark:text-emerald-100/85">
        {label}
        {required && (
          <span className="mr-0.5 text-red-500 dark:text-red-300">*</span>
        )}
      </label>

      {children}

      {error && (
        <p className="text-xs font-bold text-red-500 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}
