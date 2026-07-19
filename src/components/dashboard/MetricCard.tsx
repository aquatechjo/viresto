"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { AnimatedCounter, staggerItem } from "@/components/motion";

interface MetricCardProps {
  label: string;
  value: string | number;
  sub: string;
  icon: ReactNode;
  href: string;
  alert?: boolean;
}

export default function MetricCard({ label, value, sub, icon, href, alert = false }: MetricCardProps) {
  return (
    <motion.div variants={staggerItem} className="min-w-0">
      <Link
        href={href}
        className="group card block min-w-0 p-3.5 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              alert
                ? "bg-red-500/15 text-red-600 dark:text-red-300"
                : "bg-teal-500/15 text-teal-700 dark:bg-teal-300/10 dark:text-teal-200"
            }`}
          >
            {icon}
          </div>
          <ArrowRight
            className="h-4 w-4 opacity-0 transition group-hover:opacity-100 rtl:rotate-180"
            style={{ color: "var(--text-3)" }}
          />
        </div>
        <p className="mt-3 text-xs font-bold" style={{ color: "var(--text-3)" }}>
          {label}
        </p>
        <p
          className="mt-1 truncate text-2xl font-black"
          style={{ color: alert ? "#dc2626" : "var(--text)" }}
        >
          {typeof value === "number" ? <AnimatedCounter value={value} /> : value}
        </p>
        <p className="mt-1.5 line-clamp-2 text-xs leading-5" style={{ color: "var(--text-3)" }}>
          {sub}
        </p>
      </Link>
    </motion.div>
  );
}
