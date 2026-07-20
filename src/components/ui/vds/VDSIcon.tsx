"use client";

import type { ReactNode } from "react";
import { vds, type VDSTone } from "./tokens";

interface VDSIconProps {
  children: ReactNode;
  tone?: VDSTone;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = { sm: "h-9 w-9 rounded-xl", md: "h-11 w-11 rounded-2xl", lg: "h-12 w-12 rounded-2xl" };

export default function VDSIcon({ children, tone = "teal", size = "md", className = "" }: VDSIconProps) {
  const color = vds.tone[tone];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center border ${sizes[size]} ${className}`}
      style={{ color: color.fg, background: color.soft, borderColor: color.border }}
    >
      {children}
    </span>
  );
}
