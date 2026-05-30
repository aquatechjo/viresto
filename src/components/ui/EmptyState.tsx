interface Props {
  icon?: string
  title: string
  sub?: string
  action?: React.ReactNode
}

export default function EmptyState({
  icon = '📂',
  title,
  sub,
  action,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.03] py-16 px-6 text-center">
      <span className="mb-4 text-5xl opacity-50">
        {icon}
      </span>

      <p
        className="text-lg font-bold"
        style={{ color: 'var(--text-2)' }}
      >
        {title}
      </p>

      {sub && (
        <p
          className="mt-2 max-w-md text-sm leading-6"
          style={{ color: 'var(--text-3)' }}
        >
          {sub}
        </p>
      )}

      {action && (
        <div className="mt-5">
          {action}
        </div>
      )}
    </div>
  )
}