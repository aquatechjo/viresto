import type { Locale } from "@/lib/i18n";
import type { PluralForms } from "@/lib/plural";
import type { AgendaKind, CaseStatusKey, CourtLevel, TaskPriority } from "@/lib/dashboard/types";

// Every count sentence on the dashboard, in both languages. "{n}" becomes
// the count in Latin digits (src/lib/plural.ts).
export const PLURALS = {
  appointmentsToday: {
    ar: { zero: "لا مواعيد اليوم", one: "موعد واحد اليوم", two: "موعدان اليوم", few: "{n} مواعيد اليوم", many: "{n} موعدًا اليوم" },
    en: { zero: "no appointments today", one: "1 appointment today", other: "{n} appointments today" },
  },
  tasksNeedingFollowUp: {
    ar: { zero: "لا مهام تحتاج متابعة", one: "مهمة واحدة تحتاج متابعة", two: "مهمتان تحتاجان متابعة", few: "{n} مهام تحتاج متابعة", many: "{n} مهمة تحتاج متابعة" },
    en: { zero: "no tasks needing follow-up", one: "1 task needing follow-up", other: "{n} tasks needing follow-up" },
  },
  overdueTasks: {
    ar: { zero: "لا مهام متأخرة", one: "مهمة متأخرة واحدة", two: "مهمتان متأخرتان", few: "{n} مهام متأخرة", many: "{n} مهمة متأخرة" },
    en: { zero: "No overdue tasks", one: "1 overdue task", other: "{n} overdue tasks" },
  },
  dueTodayTasks: {
    ar: { zero: "لا مهام مستحقة اليوم", one: "مهمة واحدة مستحقة اليوم", two: "مهمتان مستحقتان اليوم", few: "{n} مهام مستحقة اليوم", many: "{n} مهمة مستحقة اليوم" },
    en: { zero: "Nothing due today", one: "1 task due today", other: "{n} tasks due today" },
  },
  overdueInvoices: {
    ar: { zero: "لا فواتير متأخرة", one: "فاتورة متأخرة واحدة", two: "فاتورتان متأخرتان", few: "{n} فواتير متأخرة", many: "{n} فاتورة متأخرة" },
    en: { zero: "No overdue invoices", one: "1 overdue invoice", other: "{n} overdue invoices" },
  },
  sessionsWithin48h: {
    ar: { zero: "لا جلسات خلال 48 ساعة", one: "جلسة واحدة خلال 48 ساعة", two: "جلستان خلال 48 ساعة", few: "{n} جلسات خلال 48 ساعة", many: "{n} جلسة خلال 48 ساعة" },
    en: { zero: "No sessions within 48 hours", one: "1 court session within 48 hours", other: "{n} court sessions within 48 hours" },
  },
  staleCases: {
    ar: { zero: "لا قضايا راكدة", one: "قضية واحدة بلا نشاط منذ 30 يومًا", two: "قضيتان بلا نشاط منذ 30 يومًا", few: "{n} قضايا بلا نشاط منذ 30 يومًا", many: "{n} قضية بلا نشاط منذ 30 يومًا" },
    en: { zero: "No idle cases", one: "1 case idle for 30 days", other: "{n} cases idle for 30 days" },
  },
  ofTotalCases: {
    ar: { zero: "من أصل 0 قضية", one: "من أصل قضية واحدة", two: "من أصل قضيتين", few: "من أصل {n} قضايا", many: "من أصل {n} قضية" },
    en: { zero: "of 0 cases", one: "of 1 case", other: "of {n} cases" },
  },
  totalClients: {
    ar: { zero: "لا موكلين بعد", one: "موكل واحد إجمالًا", two: "موكلان إجمالًا", few: "{n} موكلين إجمالًا", many: "{n} موكلًا إجمالًا" },
    en: { zero: "No clients yet", one: "1 client in total", other: "{n} clients in total" },
  },
  days: {
    ar: { zero: "أقل من يوم", one: "يوم واحد", two: "يومان", few: "{n} أيام", many: "{n} يومًا" },
    en: { zero: "less than a day", one: "1 day", other: "{n} days" },
  },
  // After "خلال" the dual and plural take the genitive (يومين، أيام).
  endsIn: {
    ar: { zero: "ينتهي اليوم", one: "ينتهي خلال يوم واحد", two: "ينتهي خلال يومين", few: "ينتهي خلال {n} أيام", many: "ينتهي خلال {n} يومًا" },
    en: { zero: "Ends today", one: "Ends in 1 day", other: "Ends in {n} days" },
  },
  locksIn: {
    ar: { zero: "يُقفل الحساب اليوم", one: "يُقفل الحساب خلال يوم واحد", two: "يُقفل الحساب خلال يومين", few: "يُقفل الحساب خلال {n} أيام", many: "يُقفل الحساب خلال {n} يومًا" },
    en: { zero: "Account locks today", one: "Account locks in 1 day", other: "Account locks in {n} days" },
  },
  members: {
    ar: { zero: "لا أعضاء", one: "عضو واحد", two: "عضوان", few: "{n} أعضاء", many: "{n} عضوًا" },
    en: { zero: "No members", one: "1 member", other: "{n} members" },
  },
  pendingInvitations: {
    ar: { zero: "لا دعوات معلقة", one: "دعوة معلقة واحدة", two: "دعوتان معلقتان", few: "{n} دعوات معلقة", many: "{n} دعوة معلقة" },
    en: { zero: "No pending invitations", one: "1 pending invitation", other: "{n} pending invitations" },
  },
  moreItems: {
    ar: { zero: "", one: "وعنصر آخر", two: "وعنصران آخران", few: "و{n} عناصر أخرى", many: "و{n} عنصرًا آخر" },
    en: { zero: "", one: "and 1 more", other: "and {n} more" },
  },
  cases: {
    ar: { zero: "لا قضايا", one: "قضية واحدة", two: "قضيتان", few: "{n} قضايا", many: "{n} قضية" },
    en: { zero: "No cases", one: "1 case", other: "{n} cases" },
  },
} satisfies Record<string, PluralForms>;

export const TEXT = {
  ar: {
    morning: "صباح الخير",
    evening: "مساء الخير",
    clearDay: "لا توجد عناصر عاجلة تحتاج متابعة اليوم.",
    youHave: "لديك",
    and: "و",
    quickActions: "إجراءات سريعة",
    addClient: "موكل",
    addCase: "قضية",
    addAppointment: "موعد",
    createInvoice: "فاتورة",
    uploadDocument: "مستند",
    refresh: "تحديث",
    refreshing: "جارٍ التحديث",
    refreshSuccess: "تم تحديث البيانات",
    refreshError: "تعذر تحديث بعض البيانات",
    loadingFailed: "تعذر تحميل بعض بيانات لوحة التحكم.",
    retry: "إعادة المحاولة",
    viewAll: "عرض الكل",

    kpiActiveCases: "القضايا النشطة",
    kpiSessions: "جلسات هذا الأسبوع",
    kpiSessionsHint: "خلال الأيام السبعة القادمة",
    kpiOverdueTasks: "مهام متأخرة",
    kpiOnTrack: "كل المهام ضمن موعدها",
    kpiOutstanding: "ذمم غير محصلة",
    kpiCollected: "تحصيل هذا الشهر",
    kpiNoBase: "لا تحصيل في الشهر الماضي للمقارنة",
    kpiVsLastMonth: "عن الشهر الماضي",
    kpiNewClients: "موكلون جدد هذا الشهر",
    kpiTodayAppointments: "مواعيد اليوم",
    kpiTodayHint: "غير الملغاة",
    kpiDueToday: "مهام مستحقة اليوم",
    kpiDueTodayHint: "قبل نهاية يوم العمل",
    kpiOverdueHint: "تجاوزت موعد الاستحقاق",
    kpiNoOverdueInvoices: "لا فواتير متأخرة",

    attention: "يحتاج انتباهك",
    attentionOverdueAmount: (amount: string) => `رصيد متأخر ${amount}`,
    attentionOverdueTasksSub: "تجاوزت موعد الاستحقاق",
    attentionSessionsSub: "راجع ملفات الجلسات القريبة",
    attentionStaleSub: "قضايا مفتوحة لم تُحدَّث",
    trialEnding: "التجربة المجانية تنتهي قريبًا",
    paymentFailed: "فشل تجديد الاشتراك",
    cancelling: "الاشتراك لن يتجدد",

    agenda: "أجندة الأيام السبعة",
    agendaEmpty: "لا جلسات ولا مواعيد ولا مهام خلال الأسبوع",
    addAppointmentAction: "إنشاء موعد",
    today: "اليوم",
    tomorrow: "غدًا",
    allDay: "طوال اليوم",

    tasks: "المهام القادمة",
    tasksEmpty: "لا مهام مفتوحة",
    addTaskAction: "إنشاء مهمة",
    overdue: "متأخرة",
    dueToday: "اليوم",
    dueTomorrow: "غدًا",

    finance: "الفوترة والتحصيل",
    financeSub: "آخر 6 أشهر",
    invoiced: "المفوتر",
    collected: "المحصل",
    aging: "أعمار الذمم",
    agingSub: "منذ تاريخ الفاتورة",
    agingBuckets: { d0_30: "0–30 يومًا", d31_60: "31–60 يومًا", d61_90: "61–90 يومًا", d90_plus: "أكثر من 90" },
    financeEmpty: "لا فواتير ولا دفعات في آخر 6 أشهر",
    createInvoiceAction: "إنشاء فاتورة",

    casesBreakdown: "توزيع القضايا",
    byStatus: "حسب الحالة",
    byCourt: "حسب درجة المحكمة",
    casesEmpty: "لا قضايا بعد",
    addCaseAction: "إضافة قضية",
    total: "الإجمالي",

    recentCases: "أحدث القضايا",
    noClient: "بدون موكل",
    recentDocuments: "آخر المستندات",
    documentsEmpty: "لا مستندات بعد",
    uploadAction: "رفع مستند",
    noCase: "غير مرتبط بقضية",

    activity: "آخر النشاطات",
    activityEmpty: "لا نشاطات بعد",
    security: "أمني",

    account: "الحساب والاشتراك",
    plan: "الخطة",
    trialLeft: (days: string) => `متبقٍ من التجربة: ${days}`,
    renewsOn: (date: string) => `التجديد في ${date}`,
    endsOn: (date: string) => `ينتهي في ${date}`,
    users: "المستخدمون",
    storage: "التخزين",
    clients: "الموكلون",
    casesUsage: "القضايا",
    unlimited: "غير محدود",
    team: "الفريق",
    manageSubscription: "إدارة الاشتراك",
    mb: "م.ب",
    gb: "غ.ب",
  },
  en: {
    morning: "Good morning",
    evening: "Good evening",
    clearDay: "Nothing urgent needs your attention today.",
    youHave: "You have",
    and: "and",
    quickActions: "Quick actions",
    addClient: "Client",
    addCase: "Case",
    addAppointment: "Appointment",
    createInvoice: "Invoice",
    uploadDocument: "Document",
    refresh: "Refresh",
    refreshing: "Refreshing",
    refreshSuccess: "Dashboard updated",
    refreshError: "Some data could not be refreshed",
    loadingFailed: "Some dashboard data could not be loaded.",
    retry: "Retry",
    viewAll: "View all",

    kpiActiveCases: "Active cases",
    kpiSessions: "Court sessions this week",
    kpiSessionsHint: "In the next 7 days",
    kpiOverdueTasks: "Overdue tasks",
    kpiOnTrack: "All tasks on schedule",
    kpiOutstanding: "Outstanding receivables",
    kpiCollected: "Collected this month",
    kpiNoBase: "Nothing collected last month to compare",
    kpiVsLastMonth: "vs last month",
    kpiNewClients: "New clients this month",
    kpiTodayAppointments: "Today's appointments",
    kpiTodayHint: "Not cancelled",
    kpiDueToday: "Tasks due today",
    kpiDueTodayHint: "Before the end of the day",
    kpiOverdueHint: "Past their due date",
    kpiNoOverdueInvoices: "No overdue invoices",

    attention: "Needs your attention",
    attentionOverdueAmount: (amount: string) => `${amount} overdue`,
    attentionOverdueTasksSub: "Past their due date",
    attentionSessionsSub: "Review the upcoming session files",
    attentionStaleSub: "Open cases with no updates",
    trialEnding: "Your free trial ends soon",
    paymentFailed: "Subscription renewal failed",
    cancelling: "Subscription will not renew",

    agenda: "Next 7 days",
    agendaEmpty: "No sessions, appointments or deadlines this week",
    addAppointmentAction: "Create appointment",
    today: "Today",
    tomorrow: "Tomorrow",
    allDay: "All day",

    tasks: "Upcoming tasks",
    tasksEmpty: "No open tasks",
    addTaskAction: "Create task",
    overdue: "Overdue",
    dueToday: "Today",
    dueTomorrow: "Tomorrow",

    finance: "Invoicing and collections",
    financeSub: "Last 6 months",
    invoiced: "Invoiced",
    collected: "Collected",
    aging: "Receivables aging",
    agingSub: "Since invoice date",
    agingBuckets: { d0_30: "0–30 days", d31_60: "31–60 days", d61_90: "61–90 days", d90_plus: "90+ days" },
    financeEmpty: "No invoices or payments in the last 6 months",
    createInvoiceAction: "Create invoice",

    casesBreakdown: "Cases breakdown",
    byStatus: "By status",
    byCourt: "By court level",
    casesEmpty: "No cases yet",
    addCaseAction: "Add case",
    total: "Total",

    recentCases: "Recent cases",
    noClient: "No client",
    recentDocuments: "Recent documents",
    documentsEmpty: "No documents yet",
    uploadAction: "Upload document",
    noCase: "Not linked to a case",

    activity: "Recent activity",
    activityEmpty: "No activity yet",
    security: "Security",

    account: "Account and subscription",
    plan: "Plan",
    trialLeft: (days: string) => `Trial left: ${days}`,
    renewsOn: (date: string) => `Renews on ${date}`,
    endsOn: (date: string) => `Ends on ${date}`,
    users: "Users",
    storage: "Storage",
    clients: "Clients",
    casesUsage: "Cases",
    unlimited: "Unlimited",
    team: "Team",
    manageSubscription: "Manage subscription",
    mb: "MB",
    gb: "GB",
  },
};

export type DashboardText = (typeof TEXT)["ar"];

export const CASE_STATUS_LABELS: Record<Locale, Record<CaseStatusKey, string>> = {
  ar: { OPEN: "نشطة", IN_PROGRESS: "قيد المتابعة", CLOSED: "مغلقة", ARCHIVED: "مؤرشفة" },
  en: { OPEN: "Active", IN_PROGRESS: "In progress", CLOSED: "Closed", ARCHIVED: "Archived" },
};

// Chart colours that read on both the light and the dark theme.
export const CASE_STATUS_COLORS: Record<CaseStatusKey, string> = {
  OPEN: "#14b8a6",
  IN_PROGRESS: "#3b82f6",
  CLOSED: "#b87333",
  ARCHIVED: "#94a3b8",
};

export const PRIORITY_LABELS: Record<Locale, Record<TaskPriority, string>> = {
  ar: { URGENT: "عاجلة", HIGH: "عالية", MEDIUM: "متوسطة", LOW: "منخفضة" },
  en: { URGENT: "Urgent", HIGH: "High", MEDIUM: "Medium", LOW: "Low" },
};

export const COURT_LEVEL_LABELS: Record<Locale, Record<CourtLevel, string>> = {
  ar: {
    MAGISTRATE: "الصلح",
    FIRST_INSTANCE: "البداية",
    APPEAL: "الاستئناف",
    CASSATION: "التمييز",
    CRIMINAL: "الجنايات",
    SHARIA: "الشرعية",
    ADMINISTRATIVE: "الإدارية",
    OTHER: "محاكم أخرى",
    UNSPECIFIED: "بدون محكمة",
  },
  en: {
    MAGISTRATE: "Magistrate",
    FIRST_INSTANCE: "First instance",
    APPEAL: "Appeal",
    CASSATION: "Cassation",
    CRIMINAL: "Major felonies",
    SHARIA: "Sharia",
    ADMINISTRATIVE: "Administrative",
    OTHER: "Other courts",
    UNSPECIFIED: "No court",
  },
};

export const AGENDA_KIND_LABELS: Record<Locale, Record<AgendaKind, string>> = {
  ar: { COURT_SESSION: "جلسة", MEETING: "اجتماع", PHONE_CALL: "مكالمة", DEADLINE: "موعد نهائي", OTHER: "موعد", TASK: "مهمة" },
  en: { COURT_SESSION: "Session", MEETING: "Meeting", PHONE_CALL: "Call", DEADLINE: "Deadline", OTHER: "Appointment", TASK: "Task" },
};

export const SUBSCRIPTION_STATUS_LABELS: Record<Locale, Record<string, string>> = {
  ar: { ACTIVE: "نشط", TRIALING: "فترة تجريبية", PAST_DUE: "متأخر الدفع", CANCELLED: "ملغي", EXPIRED: "منتهي", UNPAID: "غير مدفوع", MISSING: "لا يوجد اشتراك" },
  en: { ACTIVE: "Active", TRIALING: "Trial", PAST_DUE: "Past due", CANCELLED: "Cancelled", EXPIRED: "Expired", UNPAID: "Unpaid", MISSING: "No subscription" },
};

export function intlLocale(locale: Locale) {
  return locale === "ar" ? "ar-JO-u-nu-latn" : "en-US";
}
