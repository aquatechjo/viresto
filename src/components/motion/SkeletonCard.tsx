"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type SkeletonCardProps = { className?: string; lines?: number };

export function SkeletonCard({ className, lines = 3 }: SkeletonCardProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className={cn("card overflow-hidden p-5", className)} aria-hidden="true">
      <motion.div
        className="h-5 w-2/5 rounded-lg bg-[var(--surface-3)]"
        animate={reduceMotion ? undefined : { opacity: [0.45, 0.9, 0.45] }}
        transition={{ duration: 1.35, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="mt-5 space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <motion.div
            key={index}
            className="h-3 rounded-full bg-[var(--surface-3)]"
            style={{ width: `${Math.max(42, 92 - index * 14)}%` }}
            animate={reduceMotion ? undefined : { opacity: [0.38, 0.78, 0.38] }}
            transition={{ duration: 1.35, delay: index * 0.08, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
    </div>
  );
}
