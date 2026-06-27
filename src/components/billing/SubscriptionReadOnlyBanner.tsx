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

  const copy = isRtl
    ? {
        title: "وضع القراءة فقط",
        message: "انتهى الاشتراك. يمكنك عرض البيانات فقط إلى حين تجديد الاشتراك.",
        action: "التجديد مطلوب",
      }
    : {
        title: "Read-only mode",
        message:
          "The subscription has ended. You can view data only until the subscription is renewed.",
        action: "Renewal required",
      };

  const cleanMessage = message?.trim();

  const hasArabic = (value?: string | null) =>
    Boolean(value && /[\u0600-\u06FF]/.test(value));

  const shouldUseIncomingMessage =
    Boolean(cleanMessage) &&
    (isRtl ? hasArabic(cleanMessage) : !hasArabic(cleanMessage));

  const displayMessage = shouldUseIncomingMessage ? cleanMessage : copy.message;

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
        <div className="min-w-0">
          <p className="text-sm font-black">{copy.title}</p>

          <p
            className="mt-1 text-sm font-bold"
            style={{ color: "var(--text-2)" }}
          >
            {displayMessage}
          </p>
        </div>

        <span
          className="w-fit shrink-0 rounded-full px-3 py-1 text-xs font-black"
          style={{
            background: "rgba(245, 158, 11, 0.16)",
            color: "#d97706",
            border: "1px solid rgba(245, 158, 11, 0.28)",
          }}
        >
          {copy.action}
        </span>
      </div>
    </div>
  );
}