import type { Locale } from "@/lib/i18n";

// Activity rows carry free-form type/title/message (older rows were
// written in Arabic or English text only). These map them to one type and
// one translated title for the dashboard feed.

export type ActivityLike = { type: string; title: string; message?: string | null };

const ACTIVITY_TEXT: Record<
  Locale,
  Record<string, { title: string; message?: string }>
> = {
  ar: {
    LOGIN_SUCCESS: { title: "تم تسجيل الدخول بنجاح" },
    LOGIN_NEW_IP: { title: "تسجيل دخول من جهاز أو IP جديد" },
    NEW_IP_LOGIN: { title: "تسجيل دخول من جهاز أو IP جديد" },
    NEW_DEVICE_LOGIN: { title: "تسجيل دخول من جهاز أو IP جديد" },
    SECURITY_LOGIN: { title: "تسجيل دخول من جهاز أو IP جديد" },
    SUSPICIOUS_LOGIN: { title: "تسجيل دخول من جهاز أو IP جديد" },

    CLIENT_CREATED: { title: "تم إنشاء موكل جديد" },
    CLIENT_UPDATED: { title: "تم تعديل بيانات موكل" },
    CLIENT_DELETED: { title: "تم حذف موكل" },

    CASE_CREATED: { title: "تم إنشاء قضية جديدة" },
    CASE_UPDATED: { title: "تم تعديل قضية" },
    CASE_DELETED: { title: "تم حذف قضية" },

    APPOINTMENT_CREATED: { title: "تم إنشاء موعد جديد" },
    APPOINTMENT_UPDATED: { title: "تم تعديل موعد" },
    APPOINTMENT_RESCHEDULED: { title: "تم تغيير وقت موعد" },
    APPOINTMENT_DELETED: { title: "تم حذف موعد" },

    PAYMENT_CREATED: { title: "تم تسجيل دفعة جديدة" },
    PAYMENT_ADDED: { title: "تم تسجيل دفعة جديدة" },
    PAYMENT_UPDATED: { title: "تم تعديل دفعة" },
    PAYMENT_DELETED: { title: "تم حذف دفعة" },

    DOCUMENT_UPLOADED: { title: "تم رفع مستند جديد" },
    DOCUMENT_CREATED: { title: "تم رفع مستند جديد" },
    DOCUMENT_UPDATED: { title: "تم تعديل مستند" },
    DOCUMENT_DELETED: { title: "تم حذف مستند" },
    DOCUMENT_OPENED: { title: "تم فتح مستند" },
    DOCUMENT_VIEWED: { title: "تم فتح مستند" },
    DOCUMENT_PREVIEWED: { title: "تم فتح مستند" },

    USER_CREATED: { title: "تم إنشاء مستخدم جديد" },
    USER_UPDATED: { title: "تم تعديل مستخدم" },
    USER_DISABLED: { title: "تم تعطيل مستخدم" },
    USER_ENABLED: { title: "تم تفعيل مستخدم" },

    AI_ASSISTANT_ENABLED: { title: "تم تفعيل المساعد الذكي" },
    AI_ASSISTANT_DISABLED: { title: "تم تعطيل المساعد الذكي" },
  },
  en: {
    LOGIN_SUCCESS: { title: "Signed in successfully" },
    LOGIN_NEW_IP: { title: "New device or IP sign-in" },
    NEW_IP_LOGIN: { title: "New device or IP sign-in" },
    NEW_DEVICE_LOGIN: { title: "New device or IP sign-in" },
    SECURITY_LOGIN: { title: "New device or IP sign-in" },
    SUSPICIOUS_LOGIN: { title: "New device or IP sign-in" },

    CLIENT_CREATED: { title: "New client created" },
    CLIENT_UPDATED: { title: "Client updated" },
    CLIENT_DELETED: { title: "Client deleted" },

    CASE_CREATED: { title: "New case created" },
    CASE_UPDATED: { title: "Case updated" },
    CASE_DELETED: { title: "Case deleted" },

    APPOINTMENT_CREATED: { title: "New appointment created" },
    APPOINTMENT_UPDATED: { title: "Appointment updated" },
    APPOINTMENT_RESCHEDULED: { title: "Appointment time changed" },
    APPOINTMENT_DELETED: { title: "Appointment deleted" },

    PAYMENT_CREATED: { title: "New payment recorded" },
    PAYMENT_ADDED: { title: "New payment recorded" },
    PAYMENT_UPDATED: { title: "Payment updated" },
    PAYMENT_DELETED: { title: "Payment deleted" },

    DOCUMENT_UPLOADED: { title: "New document uploaded" },
    DOCUMENT_CREATED: { title: "New document uploaded" },
    DOCUMENT_UPDATED: { title: "Document updated" },
    DOCUMENT_DELETED: { title: "Document deleted" },
    DOCUMENT_OPENED: { title: "Document opened" },
    DOCUMENT_VIEWED: { title: "Document opened" },
    DOCUMENT_PREVIEWED: { title: "Document opened" },

    USER_CREATED: { title: "New user created" },
    USER_UPDATED: { title: "User updated" },
    USER_DISABLED: { title: "User disabled" },
    USER_ENABLED: { title: "User enabled" },

    AI_ASSISTANT_ENABLED: { title: "AI assistant enabled" },
    AI_ASSISTANT_DISABLED: { title: "AI assistant disabled" },
  },
};

function containsAny(source: string, patterns: string[]) {
  return patterns.some((pattern) => source.includes(pattern));
}
export function normalizeActivityType(activity: ActivityLike) {
  const source = `${activity.type ?? ""} ${activity.title ?? ""} ${activity.message ?? ""}`;
  const normalized = source.toLowerCase();

  // Its message quotes the appointment title, which may contain any keyword.
  if (activity.type === "APPOINTMENT_RESCHEDULED") return "APPOINTMENT_RESCHEDULED";

  if (
    containsAny(source, ["LOGIN_SUCCESS", "تم تسجيل الدخول بنجاح"]) ||
    containsAny(normalized, ["signed in successfully", "login success"])
  ) {
    return "LOGIN_SUCCESS";
  }

  if (
    containsAny(source, [
      "LOGIN_NEW_IP",
      "NEW_IP_LOGIN",
      "NEW_DEVICE_LOGIN",
      "SECURITY_LOGIN",
      "SUSPICIOUS_LOGIN",
      "جديد IP",
      "IP جديد",
    ]) ||
    containsAny(normalized, ["new device", "new ip", "suspicious login"])
  ) {
    return "LOGIN_NEW_IP";
  }

  if (
    containsAny(source, [
      "DOCUMENT_OPENED",
      "DOCUMENT_VIEWED",
      "DOCUMENT_PREVIEWED",
      "OPEN_DOCUMENT",
      "VIEW_DOCUMENT",
      "PREVIEW_DOCUMENT",
      "فتح مستند",
      "عرض مستند",
      "معاينة مستند",
    ]) ||
    containsAny(normalized, [
      "document opened",
      "opened document",
      "document viewed",
      "viewed document",
      "document previewed",
      "previewed document",
    ])
  ) {
    return "DOCUMENT_OPENED";
  }

  if (
    containsAny(source, [
      "DOCUMENT_DELETED",
      "DOCUMENT_DELETE",
      "DELETE_DOCUMENT",
      "حذف مستند",
    ]) ||
    containsAny(normalized, ["document deleted", "deleted document"])
  ) {
    return "DOCUMENT_DELETED";
  }

  if (
    containsAny(source, [
      "DOCUMENT_UPDATED",
      "UPDATE_DOCUMENT",
      "تعديل مستند",
      "تحديث مستند",
    ]) ||
    containsAny(normalized, ["document updated", "updated document"])
  ) {
    return "DOCUMENT_UPDATED";
  }

  if (
    containsAny(source, [
      "DOCUMENT_UPLOADED",
      "DOCUMENT_CREATED",
      "UPLOAD_DOCUMENT",
      "رفع مستند",
      "مستند جديد",
    ]) ||
    containsAny(normalized, [
      "new document uploaded",
      "document uploaded",
      "uploaded document",
    ])
  ) {
    return "DOCUMENT_UPLOADED";
  }

  if (
    containsAny(source, ["CLIENT_DELETED", "DELETE_CLIENT", "حذف موكل"]) ||
    containsAny(normalized, ["client deleted", "deleted client"])
  ) {
    return "CLIENT_DELETED";
  }

  if (
    containsAny(source, [
      "CLIENT_UPDATED",
      "UPDATE_CLIENT",
      "تعديل موكل",
      "تحديث موكل",
    ]) ||
    containsAny(normalized, ["client updated", "updated client"])
  ) {
    return "CLIENT_UPDATED";
  }

  if (
    containsAny(source, [
      "CLIENT_CREATED",
      "CREATE_CLIENT",
      "موكل جديد",
      "إنشاء موكل",
    ]) ||
    containsAny(normalized, ["new client", "client created", "created client"])
  ) {
    return "CLIENT_CREATED";
  }

  if (
    containsAny(source, ["CASE_DELETED", "DELETE_CASE", "حذف قضية"]) ||
    containsAny(normalized, ["case deleted", "deleted case"])
  ) {
    return "CASE_DELETED";
  }

  if (
    containsAny(source, [
      "CASE_UPDATED",
      "UPDATE_CASE",
      "تعديل قضية",
      "تحديث قضية",
    ]) ||
    containsAny(normalized, ["case updated", "updated case"])
  ) {
    return "CASE_UPDATED";
  }

  if (
    containsAny(source, [
      "CASE_CREATED",
      "CREATE_CASE",
      "قضية جديدة",
      "إنشاء قضية",
    ]) ||
    containsAny(normalized, ["new case", "case created", "created case"])
  ) {
    return "CASE_CREATED";
  }

  if (
    containsAny(source, [
      "APPOINTMENT_DELETED",
      "DELETE_APPOINTMENT",
      "حذف موعد",
    ]) ||
    containsAny(normalized, ["appointment deleted", "deleted appointment"])
  ) {
    return "APPOINTMENT_DELETED";
  }

  if (
    containsAny(source, [
      "APPOINTMENT_UPDATED",
      "UPDATE_APPOINTMENT",
      "تعديل موعد",
      "تحديث موعد",
    ]) ||
    containsAny(normalized, ["appointment updated", "updated appointment"])
  ) {
    return "APPOINTMENT_UPDATED";
  }

  if (
    containsAny(source, [
      "APPOINTMENT_CREATED",
      "CREATE_APPOINTMENT",
      "موعد جديد",
      "إنشاء موعد",
    ]) ||
    containsAny(normalized, [
      "new appointment",
      "appointment created",
      "created appointment",
    ])
  ) {
    return "APPOINTMENT_CREATED";
  }

  if (
    containsAny(source, ["PAYMENT_DELETED", "DELETE_PAYMENT", "حذف دفعة"]) ||
    containsAny(normalized, ["payment deleted", "deleted payment"])
  ) {
    return "PAYMENT_DELETED";
  }

  if (
    containsAny(source, [
      "PAYMENT_UPDATED",
      "UPDATE_PAYMENT",
      "تعديل دفعة",
      "تحديث دفعة",
    ]) ||
    containsAny(normalized, ["payment updated", "updated payment"])
  ) {
    return "PAYMENT_UPDATED";
  }

  if (
    containsAny(source, [
      "PAYMENT_CREATED",
      "PAYMENT_ADDED",
      "CREATE_PAYMENT",
      "دفعة جديدة",
      "تسجيل دفعة",
    ]) ||
    containsAny(normalized, [
      "new payment",
      "payment recorded",
      "payment created",
      "payment added",
    ])
  ) {
    return "PAYMENT_CREATED";
  }

  if (
    containsAny(source, [
      "AI_ASSISTANT_ENABLED",
      "ENABLE_AI_ASSISTANT",
      "AI_ENABLED",
      "تفعيل المساعد الذكي",
      "تم تفعيل المساعد الذكي",
    ]) ||
    containsAny(normalized, ["ai assistant enabled", "enabled ai assistant"])
  ) {
    return "AI_ASSISTANT_ENABLED";
  }

  if (
    containsAny(source, [
      "AI_ASSISTANT_DISABLED",
      "DISABLE_AI_ASSISTANT",
      "AI_DISABLED",
      "تعطيل المساعد الذكي",
      "تم تعطيل المساعد الذكي",
    ]) ||
    containsAny(normalized, ["ai assistant disabled", "disabled ai assistant"])
  ) {
    return "AI_ASSISTANT_DISABLED";
  }

  if (
    containsAny(source, ["USER_DISABLED", "DISABLE_USER", "تعطيل مستخدم"]) ||
    containsAny(normalized, ["user disabled", "disabled user"])
  ) {
    return "USER_DISABLED";
  }

  if (
    containsAny(source, ["USER_ENABLED", "ENABLE_USER", "تفعيل مستخدم"]) ||
    containsAny(normalized, ["user enabled", "enabled user"])
  ) {
    return "USER_ENABLED";
  }

  if (
    containsAny(source, ["USER_UPDATED", "UPDATE_USER", "تعديل مستخدم"]) ||
    containsAny(normalized, ["user updated", "updated user"])
  ) {
    return "USER_UPDATED";
  }

  if (
    containsAny(source, [
      "USER_CREATED",
      "CREATE_USER",
      "مستخدم جديد",
      "إنشاء مستخدم",
    ]) ||
    containsAny(normalized, ["new user", "user created", "created user"])
  ) {
    return "USER_CREATED";
  }

  return activity.type;
}

export const SECURITY_ACTIVITY_TYPES = new Set([
  "LOGIN_NEW_IP",
  "NEW_IP_LOGIN",
  "NEW_DEVICE_LOGIN",
  "SECURITY_LOGIN",
  "SUSPICIOUS_LOGIN",
]);

export function getActivityText(activity: ActivityLike, locale: Locale) {
  const activityType = normalizeActivityType(activity);
  const translated = ACTIVITY_TEXT[locale][activityType];
  const oppositeLocale = locale === "ar" ? "en" : "ar";
  const oppositeTitle = ACTIVITY_TEXT[oppositeLocale][activityType]?.title;
  const rawMessage = activity.message?.trim();
  const rawTitle = activity.title?.trim();

  return {
    title: translated?.title ?? rawTitle ?? activityType,
    message:
      rawMessage &&
      rawMessage !== rawTitle &&
      rawMessage !== translated?.title &&
      rawMessage !== oppositeTitle
        ? rawMessage
        : undefined,
  };
}
