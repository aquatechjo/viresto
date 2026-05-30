import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import SessionGuard from '@/components/security/SessionGuard'

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

      <div className="lg:mr-64 flex flex-col min-h-screen">
        <TopBar />

        <main className="flex-1 px-5 py-5 lg:px-6 lg:py-6">
          {children}
        </main>
      </div>
    </div>
  )
}