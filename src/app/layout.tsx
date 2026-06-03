import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import './globals.css'
import ThemeProvider from '@/components/ThemeProvider'

export const metadata: Metadata = {
  title: 'Viresto | Legal Platform',

description: 'Modern legal practice management platform',

  icons: {
    icon: '/logo.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>

        <Toaster
          position="bottom-left"
          richColors
          toastOptions={{
            style: { fontFamily: 'Cairo, sans-serif', direction: 'rtl' },
          }}
        />
      </body>
    </html>
  )
}
