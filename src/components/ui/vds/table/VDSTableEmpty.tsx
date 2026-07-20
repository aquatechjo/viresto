import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import VDSEmptyState from "../VDSEmptyState";

interface VDSTableEmptyProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export default function VDSTableEmpty({
  title = "No records found",
  description,
  icon = <Inbox className="h-6 w-6" />,
  action,
}: VDSTableEmptyProps) {
  return (
    <div className="p-6">
      <VDSEmptyState
        title={title}
        description={description}
        icon={icon}
      />

      {action ? (
        <div className="-mt-2 flex justify-center pb-2">
          {action}
        </div>
      ) : null}
    </div>
  );
}