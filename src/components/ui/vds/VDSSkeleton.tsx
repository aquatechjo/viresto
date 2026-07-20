import type { HTMLAttributes } from "react";
import { vds } from "./tokens";

interface VDSSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  rounded?: "sm" | "md" | "lg" | "pill";
}

const radiusMap = {
  sm: "10px",
  md: vds.radius.control,
  lg: vds.radius.surface,
  pill: vds.radius.pill,
} as const;

export default function VDSSkeleton({
  width = "100%",
  height = 16,
  rounded = "md",
  className = "",
  style,
  ...props
}: VDSSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse ${className}`}
      style={{
        width,
        height,
        borderRadius: radiusMap[rounded],
        background: "var(--surface-2, rgba(148,163,184,.18))",
        ...style,
      }}
      {...props}
    />
  );
}
