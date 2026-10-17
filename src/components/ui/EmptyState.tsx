import type { ReactNode } from 'react'

interface Props {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

// Shared page-level empty state (Clients, Cases, Documents, Tasks, and
// VDSDataTable). Borderless so it sits directly on the surrounding card;
// colors come from theme tokens so it reads in both light and dark mode.
export default function EmptyState({
  icon = '📂',
  title,
  description,
  action,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <span className="mb-4 text-5xl opacity-50" aria-hidden="true">
        {icon}
      </span>

      <p
        className="text-lg font-bold"
        style={{ color: 'var(--text-2)' }}
      >
        {title}
      </p>

      {description && (
        <p
          className="mt-2 max-w-md text-sm leading-6"
          style={{ color: 'var(--text-3)' }}
        >
          {description}
        </p>
      )}

      {action && (
        <div className="mt-5 flex justify-center">
          {action}
        </div>
      )}
    </div>
  )
}
