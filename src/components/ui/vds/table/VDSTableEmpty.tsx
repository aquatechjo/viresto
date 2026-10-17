import type { ReactNode } from "react";
import EmptyState from "@/components/ui/EmptyState";

interface VDSTableEmptyProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export default function VDSTableEmpty({
  title = "No records found",
  description,
  icon,
  action,
}: VDSTableEmptyProps) {
  return (
    <div className="p-8">
      <EmptyState
        title={title}
        description={description}
        icon={icon}
        action={action}
      />
    </div>
  );
}
