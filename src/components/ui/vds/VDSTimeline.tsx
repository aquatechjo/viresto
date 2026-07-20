"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Stagger, staggerItem } from "@/components/motion";

interface VDSTimelineProps { children: ReactNode[] | ReactNode; }
export default function VDSTimeline({ children }: VDSTimelineProps) { return <Stagger className="relative min-w-0" stagger={0.045}>{children}</Stagger>; }

interface VDSTimelineItemProps { children: ReactNode; isLast?: boolean; lineClassName?: string; }
export function VDSTimelineItem({ children, isLast = false, lineClassName = "bg-slate-200 dark:bg-slate-700" }: VDSTimelineItemProps) {
  return (
    <motion.div variants={staggerItem} className="relative min-w-0 pb-3 last:pb-0">
      {!isLast && <span aria-hidden="true" className={`absolute bottom-0 top-12 w-px ${lineClassName}`} style={{ insetInlineStart: "1.45rem" }} />}
      {children}
    </motion.div>
  );
}
