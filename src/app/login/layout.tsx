import type { Metadata } from "next";
import type { ReactNode } from "react";

// The page is a Client Component, so its metadata lives here. Without its
// own canonical it would inherit the home page's from the root layout.
export const metadata: Metadata = {
  title: "تسجيل الدخول",
  description: "سجّل الدخول إلى Viresto لإدارة مكتب المحاماة.",
  alternates: {
    canonical: "/login",
  },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
