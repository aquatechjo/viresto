"use client";

interface SubscriptionReadOnlyBannerProps {
  visible: boolean;
  message?: string | null;
  isRtl?: boolean;
}

export default function SubscriptionReadOnlyBanner({
  visible,
  message,
  isRtl = true,
}: SubscriptionReadOnlyBannerProps) {
  if (!visible) return null;

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="rounded-3xl border p-4 text-start shadow-sm"
      style={{
        background: "rgba(245, 158, 11, 0.12)",
        borderColor: "rgba(245, 158, 11, 0.32)",
        color: "var(--text)",
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black">
            {isRtl ? "وضع القراءة فقط" : "Read-only mode"}
          </p>
          <p className="mt-1 text-sm font-bold" style={{ color: "var(--text-2)" }}>
            {message ||
              (isRtl
                ? "انتهى الاشتراك. يمكنك عرض البيانات فقط إلى حين تجديد الاشتراك."
                : "The subscription has ended. You can view data only until the subscription is renewed.")}
          </p>
        </div>

        <span
          className="w-fit rounded-full px-3 py-1 text-xs font-black"
          style={{
            background: "rgba(245, 158, 11, 0.16)",
            color: "#d97706",
            border: "1px solid rgba(245, 158, 11, 0.28)",
          }}
        >
          {isRtl ? "التجديد مطلوب" : "Renewal required"}
        </span>
      </div>
    </div>
  );
}
