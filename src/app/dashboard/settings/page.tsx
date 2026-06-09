"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

import PageLoader from "@/components/ui/PageLoader";
import FormField from "@/components/ui/FormField";
import { initials } from "@/lib/utils";

type Locale = "ar" | "en";

interface User {
  name: string;
  email: string;
  role: string;
  twoFactorEnabled?: boolean;
  tenant: {
    name: string;
    slug: string;
    plan: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    logoUrl?: string | null;
  };
}

interface CompanySettings {
  name: string;
  email: string;
  phone: string;
  address: string;
  logoUrl: string;
  aiEnabled: boolean;
  aiConsentAt: string | null;
}

const ROLE_LABELS: Record<Locale, Record<string, string>> = {
  ar: {
    OWNER: "المالك",
    ADMIN: "مدير النظام",
    LAWYER: "محامٍ",
    STAFF: "موظف",
    ASSISTANT: "مساعد",
  },
  en: {
    OWNER: "Owner",
    ADMIN: "System Admin",
    LAWYER: "Lawyer",
    STAFF: "Staff",
    ASSISTANT: "Assistant",
  },
};

const PLAN_LABELS: Record<Locale, Record<string, string>> = {
  ar: {
    FREE: "مجاني",
    PRO: "احترافي",
    ENTERPRISE: "مؤسسي",
  },
  en: {
    FREE: "Free",
    PRO: "Professional",
    ENTERPRISE: "Enterprise",
  },
};

const COPY = {
  ar: {
    fallback: "غير محدد",
    disable: "تعطيل",
    enable: "تفعيل",
    loadSettingsErrorTitle: "تعذر تحميل الإعدادات",
    loadSettingsErrorDescription: "لم نتمكن من تحميل بيانات الحساب.",
    loadAccountError: "تعذر تحميل بيانات الحساب",
    loadSettingsError: "تعذر تحميل الإعدادات",
    nameRequired: "الاسم مطلوب",
    emailRequired: "البريد الإلكتروني مطلوب",
    saveProfileSuccess: "تم حفظ البيانات",
    saveProfileError: "تعذر حفظ بيانات الحساب",
    saveProfileUnexpectedError: "حدث خطأ أثناء حفظ البيانات",
    passwordRequired: "أدخل كلمة المرور الحالية والجديدة",
    passwordMismatch: "كلمتا المرور غير متطابقتين",
    passwordTooShort: "كلمة المرور يجب أن تكون 8 أحرف على الأقل",
    passwordChanged: "تم تغيير كلمة المرور",
    passwordChangeError: "تعذر تغيير كلمة المرور",
    passwordChangeUnexpectedError: "حدث خطأ أثناء تغيير كلمة المرور",
    companyNameRequired: "اسم المكتب مطلوب",
    companySaved: "تم حفظ بيانات المكتب",
    companySaveError: "تعذر حفظ بيانات المكتب",
    companySaveUnexpectedError: "حدث خطأ أثناء حفظ بيانات المكتب",
    aiConfirm:
      "سيتم تفعيل المساعد الذكي لهذا المكتب. قد يتم إرسال السؤال وبيانات عامة محدودة إلى مزود ذكاء اصطناعي خارجي. هل تريد المتابعة؟",
    aiEnabledToast: "تم تفعيل المساعد الذكي",
    aiDisabledToast: "تم تعطيل المساعد الذكي",
    aiUpdateError: "تعذر تحديث إعدادات المساعد الذكي",
    aiUpdateUnexpectedError: "حدث خطأ أثناء تحديث إعدادات المساعد الذكي",
    qrCreated: "تم إنشاء QR Code",
    twoFASetupError: "فشل إعداد التحقق الثنائي",
    verificationCodeRequired: "أدخل رمز التحقق",
    twoFAEnabledToast: "تم تفعيل التحقق الثنائي",
    twoFAVerifyError: "فشل تفعيل التحقق الثنائي",
    heroBadge: "إعدادات النظام",
    heroTitle: "إعدادات الحساب والمكتب",
    heroDescription:
      "إدارة بيانات الحساب، معلومات المكتب، إعدادات الأمان، والمساعد الذكي من مكان واحد.",
    planPrefix: "خطة",
    statsOffice: "المكتب",
    statsRole: "الدور",
    statsPermissions: "صلاحيات الحساب",
    statsAi: "المساعد الذكي",
    enabledStatus: "مفعّل",
    disabledStatus: "غير مفعّل",
    approved: "تمت الموافقة",
    notApproved: "لم تتم الموافقة",
    stats2fa: "الحماية الثنائية",
    personalTitle: "البيانات الشخصية",
    personalSubtitle: "بيانات حساب المستخدم الحالي",
    edit: "تعديل",
    fullName: "الاسم الكامل",
    email: "البريد الإلكتروني",
    cancel: "إلغاء",
    saving: "جاري الحفظ...",
    save: "حفظ",
    name: "الاسم",
    emailShort: "البريد",
    companyTitle: "بيانات المكتب",
    companySubtitle: "تظهر هذه البيانات في الفواتير والطباعة",
    companyName: "اسم المكتب / الشركة",
    phone: "رقم الهاتف",
    address: "العنوان",
    saveCompany: "حفظ بيانات المكتب",
    aiTitle: "المساعد الذكي",
    aiDescription:
      "عند التفعيل، قد يتم إرسال السؤال وبيانات عامة محدودة عن المكتب إلى مزود ذكاء اصطناعي خارجي لمعالجة الطلب.",
    aiWarning:
      "لا يتم إرسال أسماء الموكلين أو تفاصيل القضايا الحساسة افتراضيًا. استخدم المساعد فقط للمهام التنظيمية والمتابعة.",
    savingAi: "جاري الحفظ...",
    disableAi: "تعطيل المساعد الذكي",
    enableAi: "تفعيل المساعد الذكي",
    generalSettings: "الإعدادات العامة",
    notifications: "الإشعارات",
    notificationsHint: "تنبيهات المواعيد والمهام",
    language: "اللغة",
    languageValue: "العربية",
    languageHint: "لغة الواجهة الحالية",
    darkMode: "الوضع الليلي",
    darkModeHint: "خيار واجهة محلي، لا يغيّر إعدادات النظام حاليًا",
    changePassword: "تغيير كلمة المرور",
    passwordHint: "استخدم كلمة مرور قوية لا تقل عن 8 أحرف.",
    currentPassword: "كلمة المرور الحالية",
    newPassword: "كلمة المرور الجديدة",
    confirmPassword: "تأكيد كلمة المرور",
    changingPassword: "جاري التغيير...",
    twoFATitle: "الحماية الثنائية 2FA",
    twoFADescription:
      "حماية إضافية لحسابات المحامين والإدارة عبر تطبيقات مثل Google Authenticator.",
    creating: "جاري الإنشاء...",
    enable2FA: "تفعيل 2FA",
    qrAlt: "رمز QR للتحقق الثنائي",
    enterVerificationCode: "أدخل رمز التحقق",
    confirming: "جاري التأكيد...",
    confirmActivation: "تأكيد التفعيل",
    twoFAAlreadyEnabled: "التحقق الثنائي مفعّل على هذا الحساب.",
  },
  en: {
    fallback: "Not set",
    disable: "Disable",
    enable: "Enable",
    loadSettingsErrorTitle: "Unable to load settings",
    loadSettingsErrorDescription: "We could not load the account data.",
    loadAccountError: "Unable to load account data",
    loadSettingsError: "Unable to load settings",
    nameRequired: "Name is required",
    emailRequired: "Email is required",
    saveProfileSuccess: "Profile saved",
    saveProfileError: "Unable to save account data",
    saveProfileUnexpectedError: "An error occurred while saving the data",
    passwordRequired: "Enter the current and new passwords",
    passwordMismatch: "Passwords do not match",
    passwordTooShort: "Password must be at least 8 characters",
    passwordChanged: "Password changed",
    passwordChangeError: "Unable to change password",
    passwordChangeUnexpectedError:
      "An error occurred while changing the password",
    companyNameRequired: "Office name is required",
    companySaved: "Office details saved",
    companySaveError: "Unable to save office details",
    companySaveUnexpectedError: "An error occurred while saving office details",
    aiConfirm:
      "The AI assistant will be enabled for this office. The question and limited general office data may be sent to an external AI provider. Do you want to continue?",
    aiEnabledToast: "AI assistant enabled",
    aiDisabledToast: "AI assistant disabled",
    aiUpdateError: "Unable to update AI assistant settings",
    aiUpdateUnexpectedError:
      "An error occurred while updating AI assistant settings",
    qrCreated: "QR code generated",
    twoFASetupError: "Failed to set up two-factor authentication",
    verificationCodeRequired: "Enter the verification code",
    twoFAEnabledToast: "Two-factor authentication enabled",
    twoFAVerifyError: "Failed to enable two-factor authentication",
    heroBadge: "System settings",
    heroTitle: "Account and office settings",
    heroDescription:
      "Manage account data, office information, security settings, and the AI assistant from one place.",
    planPrefix: "Plan",
    statsOffice: "Office",
    statsRole: "Role",
    statsPermissions: "Account permissions",
    statsAi: "AI assistant",
    enabledStatus: "Enabled",
    disabledStatus: "Disabled",
    approved: "Approved",
    notApproved: "Not approved",
    stats2fa: "Two-factor protection",
    personalTitle: "Personal information",
    personalSubtitle: "Current user account details",
    edit: "Edit",
    fullName: "Full name",
    email: "Email address",
    cancel: "Cancel",
    saving: "Saving...",
    save: "Save",
    name: "Name",
    emailShort: "Email",
    companyTitle: "Office information",
    companySubtitle: "These details appear on invoices and printouts",
    companyName: "Office / company name",
    phone: "Phone number",
    address: "Address",
    saveCompany: "Save office details",
    aiTitle: "AI assistant",
    aiDescription:
      "When enabled, the question and limited general office data may be sent to an external AI provider to process the request.",
    aiWarning:
      "Client names or sensitive case details are not sent by default. Use the assistant only for organizational and follow-up tasks.",
    savingAi: "Saving...",
    disableAi: "Disable AI assistant",
    enableAi: "Enable AI assistant",
    generalSettings: "General settings",
    notifications: "Notifications",
    notificationsHint: "Appointment and task alerts",
    language: "Language",
    languageValue: "English",
    languageHint: "Current interface language",
    darkMode: "Dark mode",
    darkModeHint:
      "Local interface option; it does not currently change system settings",
    changePassword: "Change password",
    passwordHint: "Use a strong password of at least 8 characters.",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    changingPassword: "Changing...",
    twoFATitle: "Two-factor authentication 2FA",
    twoFADescription:
      "Additional protection for lawyer and admin accounts using apps such as Google Authenticator.",
    creating: "Creating...",
    enable2FA: "Enable 2FA",
    qrAlt: "2FA QR code",
    enterVerificationCode: "Enter verification code",
    confirming: "Confirming...",
    confirmActivation: "Confirm activation",
    twoFAAlreadyEnabled:
      "Two-factor authentication is enabled on this account.",
  },
} satisfies Record<Locale, Record<string, string>>;

const INIT_COMPANY: CompanySettings = {
  name: "",
  email: "",
  phone: "",
  address: "",
  logoUrl: "",
  aiEnabled: false,
  aiConsentAt: null,
};

function getApiMessage(data: any, fallback: string) {
  return data?.message || data?.error || data?.data?.message || fallback;
}

function getInitialLocale(): Locale {
  if (typeof document === "undefined") return "ar";

  const htmlLang = document.documentElement.lang?.toLowerCase();
  const htmlDir = document.documentElement.dir?.toLowerCase();
  const storedLocale =
    window.localStorage.getItem("locale") ||
    window.localStorage.getItem("viresto-locale") ||
    window.localStorage.getItem("lang");

  if (storedLocale === "en" || htmlLang?.startsWith("en") || htmlDir === "ltr")
    return "en";
  return "ar";
}

function Toggle({
  on,
  set,
  disabled,
  label,
}: {
  on: boolean;
  set: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => set(!on)}
      className="relative h-6 w-11 rounded-full transition-all duration-200 disabled:opacity-60"
      style={{
        background: on ? "var(--sidebar)" : "var(--border)",
      }}
      aria-label={label}
    >
      <span
        className="absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all duration-200"
        style={{
          right: on ? 5 : "auto",
          left: on ? "auto" : 5,
        }}
      />
    </button>
  );
}

function InfoLine({
  label,
  value,
  fallback,
  isArabic,
}: {
  label: string;
  value?: string | null;
  fallback: string;
  isArabic: boolean;
}) {
  const valueElement = (
    <span
      className="min-w-0 truncate text-sm font-bold"
      style={{ color: value ? "var(--text)" : "var(--text-3)" }}
    >
      {value || fallback}
    </span>
  );

  const labelElement = (
    <span
      className="shrink-0 text-xs font-black"
      style={{ color: "var(--text-3)" }}
    >
      {label}
    </span>
  );

  return (
    <div
      className="flex items-center justify-between gap-4 rounded-2xl px-4 py-3"
      style={{ background: "var(--input-bg)" }}
    >
      {isArabic ? valueElement : labelElement}
      {isArabic ? labelElement : valueElement}
    </div>
  );
}

export default function SettingsPage() {
  const [locale, setLocale] = useState<Locale>("ar");
  const isArabic = locale === "ar";
  const copy = COPY[locale];
  const direction = isArabic ? "rtl" : "ltr";
  const textAlign = isArabic ? "right" : "left";
  const [pendingAiValue, setPendingAiValue] = useState<boolean | null>(null);
  const [showAiConfirm, setShowAiConfirm] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });

  const [company, setCompany] = useState<CompanySettings>(INIT_COMPANY);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingAi, setSavingAi] = useState(false);

  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [twoFACode, setTwoFACode] = useState("");
  const [twoFALoading, setTwoFALoading] = useState(false);

  useEffect(() => {
    setLocale(getInitialLocale());
  }, []);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const [meResponse, settingsResponse] = await Promise.all([
          fetch("/api/auth/me", { cache: "no-store" }),
          fetch("/api/settings", { cache: "no-store" }),
        ]);

        if (meResponse.status === 401 || settingsResponse.status === 401) {
          window.location.href = "/login";
          return;
        }

        const meData = await meResponse.json().catch(() => ({}));
        const settingsData = await settingsResponse.json().catch(() => ({}));

        if (meData.success) {
          const currentUser = meData.data as User;

          setUser(currentUser);
          setProfileForm({
            name: currentUser.name || "",
            email: currentUser.email || "",
          });
          setTwoFAEnabled(!!currentUser.twoFactorEnabled);
        } else {
          toast.error(getApiMessage(meData, copy.loadAccountError));
        }

        if (settingsData.success) {
          setCompany({
            name: settingsData.data?.name || "",
            email: settingsData.data?.email || "",
            phone: settingsData.data?.phone || "",
            address: settingsData.data?.address || "",
            logoUrl: settingsData.data?.logoUrl || "",
            aiEnabled: !!settingsData.data?.aiEnabled,
            aiConsentAt: settingsData.data?.aiConsentAt || null,
          });
        }
      } catch {
        toast.error(copy.loadSettingsError);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [copy.loadAccountError, copy.loadSettingsError]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();

    if (!profileForm.name.trim()) {
      toast.error(copy.nameRequired);
      return;
    }

    if (!profileForm.email.trim()) {
      toast.error(copy.emailRequired);
      return;
    }

    try {
      setSavingProfile(true);

      const response = await fetch("/api/auth/update-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileForm.name,
          email: profileForm.email,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        toast.success(copy.saveProfileSuccess);
        setEditingProfile(false);

        setUser((previous) =>
          previous
            ? {
                ...previous,
                name: data.data?.name ?? profileForm.name,
                email: data.data?.email ?? profileForm.email,
              }
            : previous,
        );
      } else {
        toast.error(getApiMessage(data, copy.saveProfileError));
      }
    } catch {
      toast.error(copy.saveProfileUnexpectedError);
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();

    if (!passwordForm.current || !passwordForm.next) {
      toast.error(copy.passwordRequired);
      return;
    }

    if (passwordForm.next !== passwordForm.confirm) {
      toast.error(copy.passwordMismatch);
      return;
    }

    if (passwordForm.next.length < 8) {
      toast.error(copy.passwordTooShort);
      return;
    }

    try {
      setSavingPassword(true);

      const response = await fetch("/api/auth/update-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.current,
          newPassword: passwordForm.next,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        toast.success(copy.passwordChanged);
        setPasswordForm({
          current: "",
          next: "",
          confirm: "",
        });
      } else {
        toast.error(getApiMessage(data, copy.passwordChangeError));
      }
    } catch {
      toast.error(copy.passwordChangeUnexpectedError);
    } finally {
      setSavingPassword(false);
    }
  }

  async function saveCompany(event: FormEvent) {
    event.preventDefault();

    if (!company.name.trim()) {
      toast.error(copy.companyNameRequired);
      return;
    }

    try {
      setSavingCompany(true);

      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: company.name,
          email: company.email,
          phone: company.phone,
          address: company.address,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        toast.success(copy.companySaved);

        setUser((previous) =>
          previous
            ? {
                ...previous,
                tenant: {
                  ...previous.tenant,
                  name: data.data?.name ?? company.name,
                  email: data.data?.email ?? company.email,
                  phone: data.data?.phone ?? company.phone,
                  address: data.data?.address ?? company.address,
                  logoUrl: data.data?.logoUrl ?? company.logoUrl,
                },
              }
            : previous,
        );
      } else {
        toast.error(getApiMessage(data, copy.companySaveError));
      }
    } catch {
      toast.error(copy.companySaveUnexpectedError);
    } finally {
      setSavingCompany(false);
    }
  }

  async function applyAiValue(nextValue: boolean) {
    try {
      setSavingAi(true);

      const response = await fetch("/api/settings/ai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: nextValue,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        setCompany((previous) => ({
          ...previous,
          aiEnabled: !!data.data?.aiEnabled,
          aiConsentAt: data.data?.aiConsentAt || null,
        }));

        toast.success(nextValue ? copy.aiEnabledToast : copy.aiDisabledToast);
      } else {
        toast.error(getApiMessage(data, copy.aiUpdateError));
      }
    } catch {
      toast.error(copy.aiUpdateUnexpectedError);
    } finally {
      setSavingAi(false);
    }
  }

  async function toggleAi() {
    const nextValue = !company.aiEnabled;

    if (nextValue) {
      setPendingAiValue(nextValue);
      setShowAiConfirm(true);
      return;
    }

    await applyAiValue(nextValue);
  }

  function cancelAiEnable() {
    setShowAiConfirm(false);
    setPendingAiValue(null);
  }

  async function confirmAiEnable() {
    if (pendingAiValue === null) return;

    const nextValue = pendingAiValue;
    setShowAiConfirm(false);
    setPendingAiValue(null);
    await applyAiValue(nextValue);
  }

  async function setup2FA() {
    try {
      setTwoFALoading(true);

      const response = await fetch("/api/auth/2fa/setup", {
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        setQrCode(data.data?.qrCode || "");
        toast.success(copy.qrCreated);
      } else {
        toast.error(getApiMessage(data, copy.twoFASetupError));
      }
    } catch {
      toast.error(copy.twoFASetupError);
    } finally {
      setTwoFALoading(false);
    }
  }

  async function verify2FA() {
    if (!twoFACode.trim()) {
      toast.error(copy.verificationCodeRequired);
      return;
    }

    try {
      setTwoFALoading(true);

      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: twoFACode,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        setTwoFAEnabled(true);
        setQrCode("");
        setTwoFACode("");
        toast.success(copy.twoFAEnabledToast);
      } else {
        toast.error(getApiMessage(data, copy.twoFAVerifyError));
      }
    } catch {
      toast.error(copy.twoFAVerifyError);
    } finally {
      setTwoFALoading(false);
    }
  }

  if (loading) return <PageLoader />;

  if (!user) {
    return (
      <div className="card p-10 text-center" dir={direction}>
        <h1 className="text-2xl font-black" style={{ color: "var(--text)" }}>
          {copy.loadSettingsErrorTitle}
        </h1>

        <p className="mt-2 text-sm" style={{ color: "var(--text-3)" }}>
          {copy.loadSettingsErrorDescription}
        </p>
      </div>
    );
  }

  const roleLabel = ROLE_LABELS[locale][user.role] ?? user.role;
  const planLabel = PLAN_LABELS[locale][user.tenant.plan] ?? user.tenant.plan;
  const enabledText = copy.enabledStatus;
  const disabledText = copy.disabledStatus;

  return (
    <>
      <div className="space-y-5 stagger" dir={direction} style={{ textAlign }}>
        {/* Hero */}
        <div
          className="relative overflow-hidden rounded-[28px] border p-6"
          style={{
            background:
              "linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 60%, var(--sidebar-dark) 100%)",
            borderColor: "rgba(255,255,255,0.12)",
            boxShadow: "0 18px 50px rgba(45, 74, 62, 0.18)",
          }}
        >
          <div
            className="absolute -left-14 -top-14 h-40 w-40 rounded-full"
            style={{ background: "rgba(245, 200, 66, 0.16)" }}
          />

          <div
            className="absolute -bottom-20 right-16 h-52 w-52 rounded-full"
            style={{ background: "rgba(255,255,255,0.08)" }}
          />

          <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl text-2xl font-black"
                style={{
                  background: "#fff",
                  color: "var(--sidebar)",
                }}
              >
                {initials(user.name)}
              </div>

              <div className="min-w-0">
                <div
                  className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
                  style={{
                    background: "rgba(255,255,255,0.14)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.18)",
                  }}
                >
                  {copy.heroBadge}
                </div>

                <h1 className="truncate text-2xl font-black text-white">
                  {copy.heroTitle}
                </h1>

                <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-white/75">
                  {copy.heroDescription}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span
                className="rounded-full px-4 py-2 text-xs font-black"
                style={{
                  background: "rgba(255,255,255,0.14)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.18)",
                }}
              >
                {roleLabel}
              </span>

              <span
                className="rounded-full px-4 py-2 text-xs font-black"
                style={{
                  background: "rgba(245,200,66,0.18)",
                  color: "#fff",
                  border: "1px solid rgba(245,200,66,0.35)",
                }}
              >
                {copy.planPrefix} {planLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: copy.statsOffice,
              value: user.tenant.name || copy.fallback,
              hint: isArabic ? "اسم المكتب" : "Office name",
            },
            {
              label: copy.statsRole,
              value: roleLabel,
              hint: copy.statsPermissions,
            },
            {
              label: copy.statsAi,
              value: company.aiEnabled ? enabledText : disabledText,
              hint: company.aiConsentAt ? copy.approved : copy.notApproved,
            },
            {
              label: copy.stats2fa,
              value: twoFAEnabled ? enabledText : disabledText,
              hint: "2FA",
            },
          ].map((item) => (
            <div key={item.label} className="card p-5">
              <p
                className="text-xs font-black"
                style={{ color: "var(--text-3)" }}
              >
                {item.label}
              </p>

              <p
                className="mt-2 truncate text-xl font-black"
                style={{ color: "var(--text)" }}
              >
                {item.value}
              </p>

              <p
                className="mt-1 truncate text-xs font-bold"
                style={{ color: "var(--text-3)" }}
              >
                {item.hint || "-"}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          {/* Left */}
          <div className="space-y-5 xl:col-span-5">
            {/* Personal Info */}
            <div className="card p-5">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-black" style={{ color: "var(--text)" }}>
                    {copy.personalTitle}
                  </h2>

                  <p
                    className="mt-1 text-xs"
                    style={{ color: "var(--text-3)" }}
                  >
                    {copy.personalSubtitle}
                  </p>
                </div>

                {!editingProfile && (
                  <button
                    type="button"
                    onClick={() => setEditingProfile(true)}
                    className="btn btn-ghost"
                  >
                    {copy.edit}
                  </button>
                )}
              </div>

              <div className="mb-5 flex flex-col items-center">
                <div
                  className="mb-3 flex h-20 w-20 items-center justify-center rounded-full text-2xl font-black"
                  style={{
                    background: "var(--green-soft)",
                    color: "var(--sidebar)",
                  }}
                >
                  {initials(user.name)}
                </div>

                <p
                  className="text-lg font-black"
                  style={{ color: "var(--text)" }}
                >
                  {user.name}
                </p>

                <p
                  className="mt-1 text-xs font-bold"
                  style={{ color: "var(--text-3)" }}
                >
                  {user.email}
                </p>
              </div>

              {editingProfile ? (
                <form onSubmit={saveProfile} className="space-y-3">
                  <FormField label={copy.fullName} required>
                    <input
                      value={profileForm.name}
                      onChange={(event) =>
                        setProfileForm((previous) => ({
                          ...previous,
                          name: event.target.value,
                        }))
                      }
                      className="input"
                      autoFocus
                    />
                  </FormField>

                  <FormField label={copy.email} required>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(event) =>
                        setProfileForm((previous) => ({
                          ...previous,
                          email: event.target.value,
                        }))
                      }
                      className="input"
                    />
                  </FormField>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProfile(false);
                        setProfileForm({
                          name: user.name || "",
                          email: user.email || "",
                        });
                      }}
                      className="btn btn-ghost"
                    >
                      {copy.cancel}
                    </button>

                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="btn btn-primary"
                    >
                      {savingProfile ? copy.saving : copy.save}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-3">
                  <InfoLine
                    label={copy.name}
                    value={user.name}
                    fallback={copy.fallback}
                    isArabic={isArabic}
                  />
                  <InfoLine
                    label={copy.emailShort}
                    value={user.email}
                    fallback={copy.fallback}
                    isArabic={isArabic}
                  />
                  <InfoLine
                    label={copy.statsOffice}
                    value={user.tenant.name}
                    fallback={copy.fallback}
                    isArabic={isArabic}
                  />
                  <InfoLine
                    label={copy.statsRole}
                    value={roleLabel}
                    fallback={copy.fallback}
                    isArabic={isArabic}
                  />
                </div>
              )}
            </div>

            {/* Company Info */}
            <div className="card p-5">
              <div className="mb-5">
                <h2 className="font-black" style={{ color: "var(--text)" }}>
                  {copy.companyTitle}
                </h2>

                <p className="mt-1 text-xs" style={{ color: "var(--text-3)" }}>
                  {copy.companySubtitle}
                </p>
              </div>

              <form onSubmit={saveCompany} className="space-y-3">
                <FormField label={copy.companyName} required>
                  <input
                    value={company.name}
                    onChange={(event) =>
                      setCompany((previous) => ({
                        ...previous,
                        name: event.target.value,
                      }))
                    }
                    className="input"
                  />
                </FormField>

                <FormField label={copy.email}>
                  <input
                    type="email"
                    value={company.email}
                    onChange={(event) =>
                      setCompany((previous) => ({
                        ...previous,
                        email: event.target.value,
                      }))
                    }
                    className="input"
                    placeholder="company@example.com"
                  />
                </FormField>

                <FormField label={copy.phone}>
                  <input
                    value={company.phone}
                    onChange={(event) =>
                      setCompany((previous) => ({
                        ...previous,
                        phone: event.target.value,
                      }))
                    }
                    className="input"
                    placeholder="+962..."
                  />
                </FormField>

                <FormField label={copy.address}>
                  <input
                    value={company.address}
                    onChange={(event) =>
                      setCompany((previous) => ({
                        ...previous,
                        address: event.target.value,
                      }))
                    }
                    className="input"
                    placeholder={isArabic ? "الأردن - عمّان" : "Amman - Jordan"}
                  />
                </FormField>

                <button
                  type="submit"
                  disabled={savingCompany}
                  className="btn btn-primary w-full"
                >
                  {savingCompany ? copy.saving : copy.saveCompany}
                </button>
              </form>
            </div>
          </div>

          {/* Right */}
          <div className="space-y-5 xl:col-span-7">
            {/* AI */}
            <div className="card p-5">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div>
                  <h2 className="font-black" style={{ color: "var(--text)" }}>
                    {copy.aiTitle}
                  </h2>

                  <p
                    className="mt-1 max-w-2xl text-sm leading-7"
                    style={{ color: "var(--text-3)" }}
                  >
                    {copy.aiDescription}
                  </p>
                </div>

                <span
                  className={
                    company.aiEnabled ? "badge badge-green" : "badge badge-gray"
                  }
                >
                  {company.aiEnabled ? enabledText : disabledText}
                </span>
              </div>

              <div
                className="mt-4 rounded-2xl border p-4 text-sm leading-7"
                style={{
                  borderColor: "#fbbf24",
                  background: "var(--amber-soft)",
                  color: "#92400e",
                }}
              >
                {copy.aiWarning}
              </div>

              <button
                type="button"
                onClick={toggleAi}
                disabled={savingAi}
                className="btn btn-primary mt-4"
              >
                {savingAi
                  ? copy.savingAi
                  : company.aiEnabled
                    ? copy.disableAi
                    : copy.enableAi}
              </button>
            </div>

            {/* Password */}
            <div className="card p-5">
              <h2 className="font-black" style={{ color: "var(--text)" }}>
                {copy.changePassword}
              </h2>

              <p className="mt-1 text-xs" style={{ color: "var(--text-3)" }}>
                {copy.passwordHint}
              </p>

              <form
                onSubmit={savePassword}
                className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3"
              >
                <FormField label={copy.currentPassword}>
                  <input
                    type="password"
                    value={passwordForm.current}
                    onChange={(event) =>
                      setPasswordForm((previous) => ({
                        ...previous,
                        current: event.target.value,
                      }))
                    }
                    className="input"
                    placeholder="••••••••"
                  />
                </FormField>

                <FormField label={copy.newPassword}>
                  <input
                    type="password"
                    value={passwordForm.next}
                    onChange={(event) =>
                      setPasswordForm((previous) => ({
                        ...previous,
                        next: event.target.value,
                      }))
                    }
                    className="input"
                    placeholder="••••••••"
                  />
                </FormField>

                <FormField label={copy.confirmPassword}>
                  <input
                    type="password"
                    value={passwordForm.confirm}
                    onChange={(event) =>
                      setPasswordForm((previous) => ({
                        ...previous,
                        confirm: event.target.value,
                      }))
                    }
                    className="input"
                    placeholder="••••••••"
                  />
                </FormField>

                <div className="md:col-span-3">
                  <button
                    type="submit"
                    disabled={
                      savingPassword ||
                      !passwordForm.current ||
                      !passwordForm.next
                    }
                    className="btn btn-primary w-full"
                  >
                    {savingPassword
                      ? copy.changingPassword
                      : copy.changePassword}
                  </button>
                </div>
              </form>
            </div>

            {/* 2FA */}
            <div className="card p-5">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div>
                  <h2 className="font-black" style={{ color: "var(--text)" }}>
                    {copy.twoFATitle}
                  </h2>

                  <p
                    className="mt-1 max-w-2xl text-sm leading-7"
                    style={{ color: "var(--text-3)" }}
                  >
                    {copy.twoFADescription}
                  </p>
                </div>

                <span
                  className={
                    twoFAEnabled ? "badge badge-green" : "badge badge-gray"
                  }
                >
                  {twoFAEnabled ? enabledText : disabledText}
                </span>
              </div>

              {!twoFAEnabled && !qrCode && (
                <button
                  type="button"
                  onClick={setup2FA}
                  disabled={twoFALoading}
                  className="btn btn-primary mt-4"
                >
                  {twoFALoading ? copy.creating : copy.enable2FA}
                </button>
              )}

              {qrCode && (
                <div className="mt-5 space-y-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrCode}
                    alt={copy.qrAlt}
                    className="mx-auto h-52 w-52 rounded-2xl border bg-white p-2"
                    style={{ borderColor: "var(--border)" }}
                  />

                  <input
                    value={twoFACode}
                    onChange={(event) => setTwoFACode(event.target.value)}
                    placeholder={copy.enterVerificationCode}
                    className="input text-center"
                  />

                  <button
                    type="button"
                    onClick={verify2FA}
                    disabled={twoFALoading}
                    className="btn btn-primary w-full"
                  >
                    {twoFALoading ? copy.confirming : copy.confirmActivation}
                  </button>
                </div>
              )}

              {twoFAEnabled && (
                <div
                  className="mt-4 rounded-2xl border p-4 text-sm font-bold"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--green-soft)",
                    color: "var(--sidebar)",
                  }}
                >
                  {copy.twoFAAlreadyEnabled}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showAiConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div
            className="w-full max-w-lg rounded-[28px] border p-6 shadow-2xl"
            style={{
              background: "rgba(5, 24, 18, 0.98)",
              borderColor: "rgba(52, 211, 153, 0.42)",
              boxShadow:
                "0 30px 90px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
            dir={direction}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className={isArabic ? "text-right" : "text-left"}>
                <h2
                  className="text-xl font-black"
                  style={{ color: "var(--text)" }}
                >
                  {isArabic ? "تفعيل المساعد الذكي" : "Enable AI assistant"}
                </h2>

                <p
                  className="mt-2 text-sm font-semibold leading-7"
                  style={{ color: "var(--text-3)" }}
                >
                  {copy.aiConfirm}
                </p>
              </div>

              <button
                type="button"
                onClick={cancelAiEnable}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-lg font-bold transition hover:bg-white/10"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-2)",
                }}
                aria-label={isArabic ? "إغلاق" : "Close"}
              >
                ×
              </button>
            </div>

            <div
              className="mb-6 rounded-2xl border px-4 py-3 text-sm font-bold leading-7"
              style={{
                borderColor: "#fbbf24",
                background: "var(--amber-soft)",
                color: "#92400e",
              }}
            >
              {copy.aiWarning}
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={cancelAiEnable}
                disabled={savingAi}
                className="btn btn-ghost"
              >
                {copy.cancel}
              </button>

              <button
                type="button"
                onClick={confirmAiEnable}
                disabled={savingAi}
                className="btn btn-primary"
              >
                {savingAi
                  ? copy.savingAi
                  : isArabic
                    ? "تأكيد التفعيل"
                    : "Confirm activation"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
