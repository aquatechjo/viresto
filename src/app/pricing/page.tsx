import type { Metadata } from "next";
import PricingSection from "@/components/pricing/PricingSection";

export const metadata: Metadata = {
  title: "الأسعار والخطط",
  description:
    "خطط Viresto لمكاتب المحاماة: Basic وPro وBusiness، مع تجربة مجانية 14 يومًا بلا بطاقة.",
  alternates: {
    canonical: "/pricing",
  },
};

export default function PricingPage() {
  return <PricingSection />;
}
