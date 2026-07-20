import type { HTMLAttributes, ReactNode } from "react";

interface PartProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function VDSCardHeader({ children, className = "", ...props }: PartProps) {
  return (
    <div className={`flex min-w-0 items-start justify-between gap-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function VDSCardBody({ children, className = "", ...props }: PartProps) {
  return (
    <div className={`min-w-0 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function VDSCardFooter({ children, className = "", ...props }: PartProps) {
  return (
    <div
      className={`flex min-w-0 items-center justify-between gap-3 border-t pt-4 ${className}`}
      style={{ borderColor: "var(--border)" }}
      {...props}
    >
      {children}
    </div>
  );
}
