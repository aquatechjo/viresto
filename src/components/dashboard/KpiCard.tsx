"use client";

import type { ReactNode } from "react";
import { StatCard, type StatHintTone } from "@/components/page";
import type { VDSTone } from "@/components/ui/vds";

export type KpiHintTone = StatHintTone;

interface KpiCardProps {
  label: string;
  value: string;
  hint: ReactNode;
  hintTone?: KpiHintTone;
  icon: ReactNode;
  tone: VDSTone;
  href: string;
  dir: "rtl" | "ltr";
}

// A dashboard figure: the shared StatCard, always with an icon, a hint and
// a link to its page.
export default function KpiCard(props: KpiCardProps) {
  return <StatCard {...props} />;
}
