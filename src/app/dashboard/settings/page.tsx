"use client";
import AppLoader from "@/components/ui/AppLoader";
import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { toast } from "sonner";

import FormField from "@/components/ui/FormField";
import { VDSBadge, VDSCard, type VDSTone } from "@/components/ui/vds";
import { initials } from "@/lib/utils";
import SubscriptionReadOnlyBanner from "@/components/billing/SubscriptionReadOnlyBanner";
import { useTenantWriteAccess } from "@/hooks/useTenantWriteAccess";
import { AI_DATA_POLICY_VERSION } from "@/lib/ai-consent";

type Locale = "ar" | "en";
type EmailChangeStep = "OLD_CODE" | "NEW_EMAIL" | "NEW_CODE";

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
  aiConsentPolicyVersion: string | null;
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
      "اقرأ نطاق معالجة البيانات التالي. لا يتم تفعيل المساعد قبل موافقة مدير المكتب الصريحة.",
    aiConsentCheckbox:
      "أوافق بصفتي مدير المكتب على إرسال أسئلة المستخدم، ومحتوى المستند فقط عند طلب تلخيصه، إلى مزود ذكاء اصطناعي خارجي للمعالجة. أفهم أن النتائج تحتاج مراجعة بشرية ويمكنني إلغاء الموافقة بتعطيل المساعد.",
    aiPolicyVersion: "إصدار سياسة المعالجة",
    aiAdminOnly: "يمكن لمدير المكتب فقط تغيير هذا الإعداد.",
    aiEnabledToast: "تم تفعيل المساعد الذكي",
    aiDisabledToast: "تم تعطيل المساعد الذكي",
    aiUpdateError: "تعذر تحديث إعدادات المساعد الذكي",
    aiUpdateUnexpectedError: "حدث خطأ أثناء تحديث إعدادات المساعد الذكي",
    qrCreated: "تم إنشاء QR Code",
    twoFASetupError: "فشل إعداد التحقق الثنائي",
    twoFAPasswordRequired: "أدخل كلمة المرور الحالية لتفعيل الحماية الثنائية",
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
    emailChangeDisabled:
      "يتطلب تغيير البريد تأكيد البريد الحالي ثم تأكيد البريد الجديد.",
    changeEmail: "تغيير البريد الإلكتروني",
    emailChangeTitle: "تغيير بريد تسجيل الدخول",
    emailChangeOldDescription: "أرسلنا رمز تحقق إلى بريدك الإلكتروني الحالي.",
    emailChangeNewDescription:
      "أدخل البريد الجديد وسنرسل إليه رمز تحقق قبل اعتماد التغيير.",
    emailChangeConfirmDescription:
      "أدخل الرمز المرسل إلى البريد الإلكتروني الجديد.",
    verificationCode: "رمز التحقق",
    verifyCurrentEmail: "تأكيد البريد الحالي",
    newAccountEmail: "البريد الإلكتروني الجديد",
    sendNewEmailCode: "إرسال الرمز إلى البريد الجديد",
    confirmNewEmail: "تأكيد البريد الجديد",
    resendCode: "إعادة إرسال الرمز",
    sendingCode: "جاري إرسال الرمز...",
    verifyingCode: "جاري التحقق...",
    emailChangeStarted: "تم إرسال رمز التحقق إلى بريدك الحالي",
    currentEmailVerified: "تم تأكيد البريد الحالي",
    newEmailCodeSent: "تم إرسال رمز التحقق إلى البريد الجديد",
    emailChanged: "تم تغيير البريد الإلكتروني بنجاح",
    emailChangeError: "تعذر إكمال تغيير البريد الإلكتروني",
    invalidVerificationCode: "أدخل رمز التحقق المكوّن من 6 أرقام",
    invalidNewEmail: "أدخل بريدًا إلكترونيًا جديدًا صالحًا",
    companyTitle: "بيانات المكتب",
    companySubtitle: "تظهر هذه البيانات في الفواتير والطباعة",
    companyName: "اسم المكتب / الشركة",
    phone: "رقم الهاتف",
    address: "العنوان",
    saveCompany: "حفظ بيانات المكتب",
    aiTitle: "المساعد الذكي",
    aiDescription:
      "المحادثة ترسل سؤال المستخدم فقط. محتوى المستند يرسل فقط عندما يختار مستخدم مخوّل زر التلخيص.",
    aiWarning:
      "لا تُرسل إحصاءات المكتب أو المواعيد تلقائيًا. لا تُدخل بيانات غير ضرورية، وراجع النتائج بشريًا قبل الاعتماد عليها.",
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
      "Review the following data-processing scope. The assistant is not enabled until an office administrator explicitly consents.",
    aiConsentCheckbox:
      "As an office administrator, I consent to sending user questions, and document content only when summarization is requested, to an external AI provider for processing. I understand that results require human review and that I can revoke consent by disabling the assistant.",
    aiPolicyVersion: "Processing policy version",
    aiAdminOnly: "Only an office administrator can change this setting.",
    aiEnabledToast: "AI assistant enabled",
    aiDisabledToast: "AI assistant disabled",
    aiUpdateError: "Unable to update AI assistant settings",
    aiUpdateUnexpectedError:
      "An error occurred while updating AI assistant settings",
    qrCreated: "QR code generated",
    twoFASetupError: "Failed to set up two-factor authentication",
    twoFAPasswordRequired:
      "Enter your current password to enable two-factor authentication",
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
    emailChangeDisabled:
      "Changing the email requires verifying both the current and new addresses.",
    changeEmail: "Change email address",
    emailChangeTitle: "Change sign-in email",
    emailChangeOldDescription:
      "We sent a verification code to your current email address.",
    emailChangeNewDescription:
      "Enter the new address and we will verify it before applying the change.",
    emailChangeConfirmDescription:
      "Enter the code sent to the new email address.",
    verificationCode: "Verification code",
    verifyCurrentEmail: "Verify current email",
    newAccountEmail: "New email address",
    sendNewEmailCode: "Send code to new email",
    confirmNewEmail: "Confirm new email",
    resendCode: "Resend code",
    sendingCode: "Sending code...",
    verifyingCode: "Verifying...",
    emailChangeStarted: "A verification code was sent to your current email",
    currentEmailVerified: "Current email verified",
    newEmailCodeSent: "A verification code was sent to the new email",
    emailChanged: "Email address changed successfully",
    emailChangeError: "Unable to complete the email change",
    invalidVerificationCode: "Enter the 6-digit verification code",
    invalidNewEmail: "Enter a valid new email address",
    companyTitle: "Office information",
    companySubtitle: "These details appear on invoices and printouts",
    companyName: "Office / company name",
    phone: "Phone number",
    address: "Address",
    saveCompany: "Save office details",
    aiTitle: "AI assistant",
    aiDescription:
      "Chat sends only the user's question. Document content is sent only when an authorized user requests summarization.",
    aiWarning:
      "Office statistics and appointments are not sent automatically. Avoid unnecessary data and have a person review every result before relying on it.",
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
  aiConsentPolicyVersion: null,
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
  const displayValue = value || fallback;

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      className="flex items-center justify-between gap-4 rounded-2xl px-4 py-3"
      style={{
        background: "var(--input-bg)",
        textAlign: isArabic ? "right" : "left",
      }}
    >
      <span
        className="shrink-0 text-xs font-black"
        style={{ color: "var(--text-3)" }}
      >
        {label}
      </span>

      <span
        dir="auto"
        className="min-w-0 truncate text-sm font-bold"
        style={{
          color: value ? "var(--text)" : "var(--text-3)",
          textAlign: isArabic ? "left" : "right",
        }}
      >
        {displayValue}
      </span>
    </div>
  );
}

function getSettingsBlockFallback(locale: Locale) {
  return locale === "en"
    ? "The subscription has ended. Office and AI settings are available in read-only mode until renewal."
    : "انتهى الاشتراك. إعدادات المكتب والمساعد الذكي متاحة للقراءة فقط إلى حين التجديد.";
}

function getRoleTone(role: string): VDSTone {
  if (role === "OWNER" || role === "ADMIN") return "gold";
  if (role === "LAWYER") return "teal";
  if (role === "STAFF") return "blue";
  return "slate";
}

export default function SettingsPage() {
  const [locale, setLocale] = useState<Locale>("ar");
  const isArabic = locale === "ar";
  const copy = COPY[locale];
  const direction = isArabic ? "rtl" : "ltr";
  const textAlign = isArabic ? "right" : "left";

  const ltrInputStyle: CSSProperties = {
    textAlign: "left",
    direction: "ltr",
  };
  const passwordInputStyle: CSSProperties = {
    textAlign: isArabic ? "right" : "left",
    direction: isArabic ? "rtl" : "ltr",
  };

  function isProbablyLtr(value?: string | null) {
    return /^[\s\d+@._:/\\-]*[A-Za-z]/.test(value || "");
  }

  function smartTextInputStyle(value?: string | null): CSSProperties {
    const ltr = isProbablyLtr(value);

    return {
      textAlign: ltr ? "left" : isArabic ? "right" : "left",
      direction: ltr ? "ltr" : isArabic ? "rtl" : "ltr",
    };
  }

  const [pendingAiValue, setPendingAiValue] = useState<boolean | null>(null);
  const [showAiConfirm, setShowAiConfirm] = useState(false);
  const [aiConsentAccepted, setAiConsentAccepted] = useState(false);
  const writeAccess = useTenantWriteAccess(locale);

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

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingAi, setSavingAi] = useState(false);

  const [emailChangeOpen, setEmailChangeOpen] = useState(false);
  const [emailChangeStep, setEmailChangeStep] =
    useState<EmailChangeStep>("OLD_CODE");
  const [emailChangeRequestId, setEmailChangeRequestId] = useState("");
  const [emailChangeSentTo, setEmailChangeSentTo] = useState("");
  const [oldEmailCode, setOldEmailCode] = useState("");
  const [newAccountEmail, setNewAccountEmail] = useState("");
  const [newEmailCode, setNewEmailCode] = useState("");
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);

  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [twoFAPassword, setTwoFAPassword] = useState("");
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
            aiConsentPolicyVersion:
              settingsData.data?.aiConsentPolicyVersion || null,
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

    try {
      setSavingProfile(true);

      const response = await fetch("/api/auth/update-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileForm.name.trim(),
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
                name: data.data?.name ?? profileForm.name.trim(),
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

  function resetEmailChange() {
    setEmailChangeOpen(false);
    setEmailChangeStep("OLD_CODE");
    setEmailChangeRequestId("");
    setEmailChangeSentTo("");
    setOldEmailCode("");
    setNewAccountEmail("");
    setNewEmailCode("");
    setEmailChangeLoading(false);
  }

  async function callEmailChangeApi(payload: Record<string, string>) {
    const response = await fetch("/api/auth/change-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(getApiMessage(data, copy.emailChangeError));
    }

    return data.data || {};
  }

  async function startEmailChange() {
    try {
      setEmailChangeOpen(true);
      setEmailChangeStep("OLD_CODE");
      setEmailChangeLoading(true);
      setOldEmailCode("");
      setNewAccountEmail("");
      setNewEmailCode("");

      const data = await callEmailChangeApi({
        action: "REQUEST_OLD_CODE",
      });

      setEmailChangeRequestId(data.requestId || "");
      setEmailChangeSentTo(data.sentTo || user?.email || "");
      toast.success(copy.emailChangeStarted);
    } catch (error) {
      resetEmailChange();
      toast.error(
        error instanceof Error ? error.message : copy.emailChangeError,
      );
    } finally {
      setEmailChangeLoading(false);
    }
  }

  async function verifyCurrentEmailCode() {
    if (!/^\d{6}$/.test(oldEmailCode)) {
      toast.error(copy.invalidVerificationCode);
      return;
    }

    try {
      setEmailChangeLoading(true);
      await callEmailChangeApi({
        action: "VERIFY_OLD_CODE",
        requestId: emailChangeRequestId,
        code: oldEmailCode,
      });
      setEmailChangeStep("NEW_EMAIL");
      toast.success(copy.currentEmailVerified);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : copy.emailChangeError,
      );
    } finally {
      setEmailChangeLoading(false);
    }
  }

  async function requestNewEmailCode() {
    const normalizedEmail = newAccountEmail.trim().toLowerCase();

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      toast.error(copy.invalidNewEmail);
      return;
    }

    try {
      setEmailChangeLoading(true);
      const data = await callEmailChangeApi({
        action: "REQUEST_NEW_CODE",
        requestId: emailChangeRequestId,
        newEmail: normalizedEmail,
      });
      setNewAccountEmail(normalizedEmail);
      setNewEmailCode("");
      setEmailChangeSentTo(data.sentTo || normalizedEmail);
      setEmailChangeStep("NEW_CODE");
      toast.success(copy.newEmailCodeSent);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : copy.emailChangeError,
      );
    } finally {
      setEmailChangeLoading(false);
    }
  }

  async function confirmNewEmailCode() {
    if (!/^\d{6}$/.test(newEmailCode)) {
      toast.error(copy.invalidVerificationCode);
      return;
    }

    try {
      setEmailChangeLoading(true);
      const data = await callEmailChangeApi({
        action: "CONFIRM_NEW_EMAIL",
        requestId: emailChangeRequestId,
        code: newEmailCode,
      });
      const updatedEmail = data.email || newAccountEmail;

      setUser((previous) =>
        previous ? { ...previous, email: updatedEmail } : previous,
      );
      setProfileForm((previous) => ({ ...previous, email: updatedEmail }));
      resetEmailChange();
      toast.success(copy.emailChanged);

      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : copy.emailChangeError,
      );
    } finally {
      setEmailChangeLoading(false);
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

    if (!writeAccess.canWrite) {
      toast.error(writeAccess.message || getSettingsBlockFallback(locale));
      return;
    }

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
    if (!writeAccess.canWrite) {
      toast.error(writeAccess.message || getSettingsBlockFallback(locale));
      return;
    }

    try {
      setSavingAi(true);

      const response = await fetch("/api/settings/ai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: nextValue,
          consentAccepted: nextValue ? aiConsentAccepted : false,
          policyVersion: nextValue ? AI_DATA_POLICY_VERSION : null,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        setCompany((previous) => ({
          ...previous,
          aiEnabled: !!data.data?.aiEnabled,
          aiConsentAt: data.data?.aiConsentAt || null,
          aiConsentPolicyVersion: data.data?.aiConsentPolicyVersion || null,
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
    if (user?.role !== "ADMIN") {
      toast.error(copy.aiAdminOnly);
      return;
    }

    const nextValue = !company.aiEnabled;

    if (nextValue) {
      setAiConsentAccepted(false);
      setPendingAiValue(nextValue);
      setShowAiConfirm(true);
      return;
    }

    await applyAiValue(nextValue);
  }

  function cancelAiEnable() {
    setAiConsentAccepted(false);
    setShowAiConfirm(false);
    setPendingAiValue(null);
  }

  async function confirmAiEnable() {
    if (pendingAiValue === null || !aiConsentAccepted) return;

    const nextValue = pendingAiValue;
    setShowAiConfirm(false);
    setPendingAiValue(null);
    await applyAiValue(nextValue);
    setAiConsentAccepted(false);
  }

  async function setup2FA() {
    if (!twoFAPassword) {
      toast.error(copy.twoFAPasswordRequired);
      return;
    }

    try {
      setTwoFALoading(true);

      const response = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: twoFAPassword }),
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        setQrCode(data.data?.qrCode || "");
        setTwoFAPassword("");
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

  if (loading) {
    return <AppLoader fullScreen={false} />;
  }
  if (!user) {
    return (
      <VDSCard padded={false} className="p-10 text-center" dir={direction}>
        <h1 className="text-2xl font-black" style={{ color: "var(--text)" }}>
          {copy.loadSettingsErrorTitle}
        </h1>

        <p className="mt-2 text-sm" style={{ color: "var(--text-3)" }}>
          {copy.loadSettingsErrorDescription}
        </p>
      </VDSCard>
    );
  }

  const roleLabel = ROLE_LABELS[locale][user.role] ?? user.role;
  const planLabel = PLAN_LABELS[locale][user.tenant.plan] ?? user.tenant.plan;
  const enabledText = copy.enabledStatus;
  const disabledText = copy.disabledStatus;

  return (
    <>
      <div className="space-y-5 stagger" dir={direction} style={{ textAlign }}>
        <SubscriptionReadOnlyBanner
          visible={!writeAccess.canWrite}
          message={writeAccess.message}
          isRtl={isArabic}
        />

        {/* Hero */}
        <div
          className="relative overflow-hidden rounded-[28px] border p-6"
          style={{
            background:
              "linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 60%, var(--sidebar-dark) 100%)",
            borderColor: "rgba(255,255,255,0.12)",
            boxShadow: "0 18px 50px rgba(15, 61, 62, 0.18)",
          }}
        >
          <div
            className="absolute -left-14 -top-14 h-40 w-40 rounded-full"
            style={{ background: "rgba(184, 115, 51, 0.16)" }}
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
              <VDSBadge tone={getRoleTone(user.role)}>{roleLabel}</VDSBadge>

              <VDSBadge tone="gold">
                {copy.planPrefix} {planLabel}
              </VDSBadge>
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
              hint:
                company.aiConsentAt &&
                company.aiConsentPolicyVersion === AI_DATA_POLICY_VERSION
                  ? copy.approved
                  : copy.notApproved,
            },
            {
              label: copy.stats2fa,
              value: twoFAEnabled ? enabledText : disabledText,
              hint: "2FA",
            },
          ].map((item) => (
            <VDSCard key={item.label} padded={false} className="p-5">
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
            </VDSCard>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          {/* Left */}
          <div className="space-y-5 xl:col-span-5">
            {/* Personal Info */}
            <VDSCard padded={false} className="p-5">
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
                      style={smartTextInputStyle(profileForm.name)}
                      autoFocus
                    />
                  </FormField>

                  <FormField label={copy.email}>
                    <input
                      type="email"
                      value={profileForm.email}
                      readOnly
                      disabled
                      dir="ltr"
                      className="input cursor-not-allowed opacity-70"
                      style={ltrInputStyle}
                    />
                    <p
                      className="mt-1 text-xs font-semibold"
                      style={{ color: "var(--text-3)" }}
                    >
                      {copy.emailChangeDisabled}
                    </p>

                    <button
                      type="button"
                      onClick={startEmailChange}
                      disabled={emailChangeLoading}
                      className="btn btn-ghost mt-2 w-full"
                    >
                      {emailChangeLoading ? copy.sendingCode : copy.changeEmail}
                    </button>
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
            </VDSCard>

            {/* Company Info */}
            <VDSCard padded={false} className="p-5">
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
                    style={smartTextInputStyle(company.name)}
                  />
                </FormField>

                <FormField label={copy.email}>
                  <input
                    dir="ltr"
                    type="email"
                    value={company.email}
                    onChange={(event) =>
                      setCompany((previous) => ({
                        ...previous,
                        email: event.target.value,
                      }))
                    }
                    className="input"
                    style={ltrInputStyle}
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
                    dir="ltr"
                    className="input"
                    style={ltrInputStyle}
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
                    style={smartTextInputStyle(company.address)}
                    placeholder={isArabic ? "الأردن - عمّان" : "Amman - Jordan"}
                  />
                </FormField>

                <button
                  type="submit"
                  disabled={savingCompany || !writeAccess.canWrite}
                  title={
                    !writeAccess.canWrite
                      ? writeAccess.message || getSettingsBlockFallback(locale)
                      : copy.saveCompany
                  }
                  className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingCompany ? copy.saving : copy.saveCompany}
                </button>
              </form>
            </VDSCard>
          </div>

          {/* Right */}
          <div className="space-y-5 xl:col-span-7">
            {/* AI */}
            <VDSCard padded={false} className="p-5">
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

                <VDSBadge tone={company.aiEnabled ? "teal" : "slate"}>
                  {company.aiEnabled ? enabledText : disabledText}
                </VDSBadge>
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
                disabled={
                  savingAi || !writeAccess.canWrite || user?.role !== "ADMIN"
                }
                title={
                  !writeAccess.canWrite
                    ? writeAccess.message || getSettingsBlockFallback(locale)
                    : user?.role !== "ADMIN"
                      ? copy.aiAdminOnly
                      : undefined
                }
                className="btn btn-primary mt-4 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingAi
                  ? copy.savingAi
                  : company.aiEnabled
                    ? copy.disableAi
                    : copy.enableAi}
              </button>

              {user?.role !== "ADMIN" ? (
                <p
                  className="mt-3 text-xs font-bold"
                  style={{ color: "var(--text-3)" }}
                >
                  {copy.aiAdminOnly}
                </p>
              ) : null}
            </VDSCard>

            {/* Password */}
            <VDSCard padded={false} className="p-5">
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
                    dir="ltr"
                    type="password"
                    value={passwordForm.current}
                    onChange={(event) =>
                      setPasswordForm((previous) => ({
                        ...previous,
                        current: event.target.value,
                      }))
                    }
                    className="input"
                    style={passwordInputStyle}
                    placeholder="••••••••"
                  />
                </FormField>

                <FormField label={copy.newPassword}>
                  <input
                    dir="ltr"
                    type="password"
                    value={passwordForm.next}
                    onChange={(event) =>
                      setPasswordForm((previous) => ({
                        ...previous,
                        next: event.target.value,
                      }))
                    }
                    className="input"
                    style={passwordInputStyle}
                    placeholder="••••••••"
                  />
                </FormField>

                <FormField label={copy.confirmPassword}>
                  <input
                    dir="ltr"
                    type="password"
                    value={passwordForm.confirm}
                    onChange={(event) =>
                      setPasswordForm((previous) => ({
                        ...previous,
                        confirm: event.target.value,
                      }))
                    }
                    className="input"
                    style={passwordInputStyle}
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
            </VDSCard>

            {/* 2FA */}
            <VDSCard padded={false} className="p-5">
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

                <VDSBadge tone={twoFAEnabled ? "teal" : "slate"}>
                  {twoFAEnabled ? enabledText : disabledText}
                </VDSBadge>
              </div>

              {!twoFAEnabled && !qrCode && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void setup2FA();
                  }}
                  className="mt-4 max-w-md space-y-3"
                >
                  <FormField label={copy.currentPassword}>
                    <input
                      dir="ltr"
                      type="password"
                      autoComplete="current-password"
                      value={twoFAPassword}
                      onChange={(event) => setTwoFAPassword(event.target.value)}
                      className="input"
                      style={passwordInputStyle}
                      placeholder="••••••••"
                    />
                  </FormField>

                  <button
                    type="submit"
                    disabled={twoFALoading || !twoFAPassword}
                    className="btn btn-primary w-full"
                  >
                    {twoFALoading ? copy.creating : copy.enable2FA}
                  </button>
                </form>
              )}

              {qrCode && (
                <div className="mt-5 space-y-4">
                  {}
                  <img
                    src={qrCode}
                    alt={copy.qrAlt}
                    className="mx-auto h-52 w-52 rounded-2xl border bg-white p-2"
                    style={{ borderColor: "var(--border)" }}
                  />

                  <input
                    value={twoFACode}
                    onChange={(event) =>
                      setTwoFACode(
                        event.target.value.replace(/\D/g, "").slice(0, 6),
                      )
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
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
            </VDSCard>
          </div>
        </div>
      </div>

      {emailChangeOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div
            className="w-full max-w-lg rounded-[28px] border p-6 shadow-2xl"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
              boxShadow: "0 30px 90px rgba(0,0,0,0.45)",
            }}
            dir={direction}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className={isArabic ? "text-right" : "text-left"}>
                <h2
                  className="text-xl font-black"
                  style={{ color: "var(--text)" }}
                >
                  {copy.emailChangeTitle}
                </h2>
                <p
                  className="mt-2 text-sm font-semibold leading-7"
                  style={{ color: "var(--text-3)" }}
                >
                  {emailChangeStep === "OLD_CODE"
                    ? copy.emailChangeOldDescription
                    : emailChangeStep === "NEW_EMAIL"
                      ? copy.emailChangeNewDescription
                      : copy.emailChangeConfirmDescription}
                </p>
              </div>

              <button
                type="button"
                onClick={resetEmailChange}
                disabled={emailChangeLoading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-lg font-bold transition hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-2)",
                }}
                aria-label={isArabic ? "إغلاق" : "Close"}
              >
                ×
              </button>
            </div>

            {emailChangeSentTo && emailChangeStep !== "NEW_EMAIL" ? (
              <div
                dir="ltr"
                className="mb-4 rounded-2xl border px-4 py-3 text-center text-sm font-bold"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--green-soft)",
                  color: "var(--sidebar)",
                }}
              >
                {emailChangeSentTo}
              </div>
            ) : null}

            {emailChangeStep === "OLD_CODE" ? (
              <div className="space-y-4">
                <FormField label={copy.verificationCode} required>
                  <input
                    value={oldEmailCode}
                    onChange={(event) =>
                      setOldEmailCode(
                        event.target.value.replace(/\D/g, "").slice(0, 6),
                      )
                    }
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="input text-center text-xl font-black tracking-[0.35em]"
                    placeholder="000000"
                    autoFocus
                  />
                </FormField>

                <button
                  type="button"
                  onClick={verifyCurrentEmailCode}
                  disabled={emailChangeLoading || oldEmailCode.length !== 6}
                  className="btn btn-primary w-full"
                >
                  {emailChangeLoading
                    ? copy.verifyingCode
                    : copy.verifyCurrentEmail}
                </button>

                <button
                  type="button"
                  onClick={startEmailChange}
                  disabled={emailChangeLoading}
                  className="btn btn-ghost w-full"
                >
                  {copy.resendCode}
                </button>
              </div>
            ) : null}

            {emailChangeStep === "NEW_EMAIL" ? (
              <div className="space-y-4">
                <FormField label={copy.newAccountEmail} required>
                  <input
                    type="email"
                    value={newAccountEmail}
                    onChange={(event) => setNewAccountEmail(event.target.value)}
                    dir="ltr"
                    autoComplete="email"
                    className="input"
                    style={ltrInputStyle}
                    placeholder="new@example.com"
                    autoFocus
                  />
                </FormField>

                <button
                  type="button"
                  onClick={requestNewEmailCode}
                  disabled={emailChangeLoading || !newAccountEmail.trim()}
                  className="btn btn-primary w-full"
                >
                  {emailChangeLoading
                    ? copy.sendingCode
                    : copy.sendNewEmailCode}
                </button>
              </div>
            ) : null}

            {emailChangeStep === "NEW_CODE" ? (
              <div className="space-y-4">
                <FormField label={copy.verificationCode} required>
                  <input
                    value={newEmailCode}
                    onChange={(event) =>
                      setNewEmailCode(
                        event.target.value.replace(/\D/g, "").slice(0, 6),
                      )
                    }
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="input text-center text-xl font-black tracking-[0.35em]"
                    placeholder="000000"
                    autoFocus
                  />
                </FormField>

                <button
                  type="button"
                  onClick={confirmNewEmailCode}
                  disabled={emailChangeLoading || newEmailCode.length !== 6}
                  className="btn btn-primary w-full"
                >
                  {emailChangeLoading
                    ? copy.verifyingCode
                    : copy.confirmNewEmail}
                </button>

                <button
                  type="button"
                  onClick={requestNewEmailCode}
                  disabled={emailChangeLoading}
                  className="btn btn-ghost w-full"
                >
                  {copy.resendCode}
                </button>
              </div>
            ) : null}

            <button
              type="button"
              onClick={resetEmailChange}
              disabled={emailChangeLoading}
              className="btn btn-ghost mt-3 w-full"
            >
              {copy.cancel}
            </button>
          </div>
        </div>
      ) : null}

      {showAiConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div
            className="w-full max-w-lg rounded-[28px] border p-6 shadow-2xl"
            style={{
              background: "rgba(5, 24, 18, 0.98)",
              borderColor: "rgba(83, 168, 164, 0.42)",
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

            <label
              className="mb-4 flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-sm font-semibold leading-7"
              style={{
                borderColor: aiConsentAccepted
                  ? "var(--accent)"
                  : "var(--border)",
                background: "var(--input-bg)",
                color: "var(--text-2)",
              }}
            >
              <input
                type="checkbox"
                checked={aiConsentAccepted}
                onChange={(event) => setAiConsentAccepted(event.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 accent-emerald-700"
              />
              <span>
                {copy.aiConsentCheckbox}
                <span
                  className="mt-2 block text-xs font-black"
                  style={{ color: "var(--text-3)" }}
                >
                  {copy.aiPolicyVersion}: {AI_DATA_POLICY_VERSION}
                </span>
              </span>
            </label>

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
                disabled={
                  savingAi || !writeAccess.canWrite || !aiConsentAccepted
                }
                title={
                  !writeAccess.canWrite
                    ? writeAccess.message || getSettingsBlockFallback(locale)
                    : undefined
                }
                className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60"
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
