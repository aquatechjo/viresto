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
      className="min-h-screen"
      style={{ background: 'var(--bg)' }}
    >
      <SessionGuard />

      <Sidebar />

      <DashboardShell>
        <TopBar />

        <main className="flex-1 px-5 py-5 lg:px-6 lg:py-6">
          {children}
        </main>
      </DashboardShell>
    </div>
  )
}