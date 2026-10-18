import type { Metadata } from "next";
import type { ReactNode } from "react";

// The page is a Client Component, so its metadata lives here. Without its
// own canonical it would inherit the home page's from the root layout.
export const metadata: Metadata = {
  title: "تسجيل مكتب جديد",
  description:
    "أنشئ حساب مكتبك على Viresto وابدأ تجربة مجانية لمدة 14 يومًا بلا بطاقة.",
  alternates: {
    canonical: "/register",
  },
};

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return children;
}
