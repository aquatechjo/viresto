"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { vds } from "./tokens";

interface VDSCardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  as?: "section" | "article" | "div";
  interactive?: boolean;
  padded?: boolean;
}

export default function VDSCard({ children, as = "section", interactive = false, padded = true, className = "", style, ...props }: VDSCardProps) {
  const Tag = as;
  return (
    <Tag
      className={`min-w-0 border ${padded ? "p-4 sm:p-5" : ""} ${interactive ? "transition duration-200 hover:-translate-y-0.5" : ""} ${className}`}
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
        borderRadius: vds.radius.card,
        boxShadow: interactive ? vds.shadow.card : "none",
        ...style,
      }}
      {...props}
    >
      {children}
    </Tag>
  );
}
