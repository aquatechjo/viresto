import VDSSkeleton from "../VDSSkeleton";

interface VDSTableSkeletonProps {
  rows?: number;
  columns?: number;
}

export default function VDSTableSkeleton({
  rows = 5,
  columns = 5,
}: VDSTableSkeletonProps) {
  return (
    <div className="overflow-hidden">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-4 border-b px-4 py-4"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            borderColor: "var(--border)",
          }}
        >
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <VDSSkeleton
              key={columnIndex}
              height={14}
              width={columnIndex === 0 ? "72%" : "88%"}
              rounded="sm"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
