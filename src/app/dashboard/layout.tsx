import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import SessionGuard from '@/components/security/SessionGuard'
import DashboardShell from '@/components/layout/DashboardShell'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="dashboard-root min-h-screen overflow-x-hidden"
      style={{ background: 'var(--bg)' }}
    >
      <SessionGuard />

      <Sidebar />

      <DashboardShell>
        <TopBar />

        <main className="dashboard-page-shell min-w-0 flex-1">
          {children}
        </main>
      </DashboardShell>
    </div>
  )
}
