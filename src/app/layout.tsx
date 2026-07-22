import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { Toaster } from "sonner";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import DynamicDocumentTitle from "@/components/DynamicDocumentTitle";
import LatinDigitsInputBoundary from "@/components/LatinDigitsInputBoundary";

const siteUrl = "https://www.virestojo.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "Viresto | Legal Practice Management Platform",
    template: "%s | Viresto",
  },

  description:
    "Viresto is a legal practice management platform for law firms to manage cases, clients, appointments, documents, invoices, payments, reports, and team operations.",

  applicationName: "Viresto",
  manifest: "/site.webmanifest",

  keywords: [
    "Viresto",
    "Viresto Legal",
    "legal practice management",
    "law firm management software",
    "case management software",
    "legal platform",
    "law office software",
    "برنامج إدارة مكاتب المحاماة",
    "إدارة القضايا",
    "منصة قانونية",
    "برنامج محامين",
    "إدارة مكتب محاماة",
  ],

  alternates: {
    canonical: siteUrl,
  },

  icons: {
    icon: [
      {
        url: "/favicon.ico",
        sizes: "any",
      },
      {
        url: "/icon-48.png",
        sizes: "48x48",
        type: "image/png",
      },
      {
        url: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    shortcut: "/favicon.ico",
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },

  openGraph: {
    title: "Viresto | Legal Practice Management Platform",
    description:
      "Manage your law firm with one platform for cases, clients, appointments, documents, invoices, payments, reports, and team operations.",
    url: siteUrl,
    siteName: "Viresto",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Viresto Legal Practice Management Platform",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Viresto | Legal Practice Management Platform",
    description: "A legal practice management platform",
    images: ["/og-image.png"],
  },

  robots: {
    index: true,
    follow: true,
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "Viresto",
      alternateName: "Viresto Legal",
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/icon-512.png`,
        width: 512,
        height: 512,
      },
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "Viresto",
      alternateName: "Viresto Legal",
      url: siteUrl,
      publisher: {
        "@id": `${siteUrl}/#organization`,
      },
    },
    {
      "@type": "WebApplication",
      "@id": `${siteUrl}/#webapp`,
      name: "Viresto",
      alternateName: ["Viresto Legal", "Viresto Legal Platform"],
      url: siteUrl,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Viresto is a legal practice management platform for law firms to manage cases, clients, appointments, documents, invoices, payments, reports, and team operations.",
      offers: {
        "@type": "Offer",
        category: "SaaS",
      },
      publisher: {
        "@id": `${siteUrl}/#organization`,
      },
    },
  ],
};

// A per-request CSP nonce requires dynamic rendering so every response receives
// matching nonces on the framework and application scripts.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <body>
        <script
          nonce={nonce}
          suppressHydrationWarning
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteJsonLd),
          }}
        />

        <ThemeProvider>
          <LatinDigitsInputBoundary>
            <DynamicDocumentTitle />
            {children}
          </LatinDigitsInputBoundary>
        </ThemeProvider>

        <Toaster
          position="bottom-left"
          richColors
          toastOptions={{
            style: {
              fontFamily: "Cairo, sans-serif",
              direction: "inherit",
              textAlign: "start",
              maxWidth: "460px",
              lineHeight: "1.8",
              borderRadius: "16px",
              fontWeight: 700,
            },
          }}
        />
      </body>
    </html>
  );
}
