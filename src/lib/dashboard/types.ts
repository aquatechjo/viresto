// The main dashboard's payload, as the browser receives it from
// /api/dashboard-stats (dates are ISO strings). Built by load-dashboard.ts.

export type DashboardRole = "ADMIN" | "LAWYER" | "STAFF";

export type CaseRef = {
  id: string;
  publicId: number;
  title: string;
  caseNumber: string | null;
};

export type ClientRef = {
  id: string;
  publicId: number;
  name: string;
};

export type AgendaKind = "COURT_SESSION" | "MEETING" | "PHONE_CALL" | "DEADLINE" | "OTHER" | "TASK";

export type AgendaItem = {
  id: string;
  kind: AgendaKind;
  title: string;
  at: string;
  // Day key in the office time zone ("2026-10-23"), for grouping.
  day: string;
  // A task due at midnight has a date, not a time.
  hasTime: boolean;
  location: string | null;
  case: CaseRef | null;
  client: ClientRef | null;
};

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type DashboardTask = {
  id: string;
  title: string;
  dueDate: string;
  priority: TaskPriority;
  case: CaseRef | null;
};

export type MonthTotals = { month: string; invoiced: number; collected: number };

export type AgingBuckets = { d0_30: number; d31_60: number; d61_90: number; d90_plus: number };

export type CaseStatusKey = "OPEN" | "IN_PROGRESS" | "CLOSED" | "ARCHIVED";

export type CourtLevel =
  | "MAGISTRATE"
  | "FIRST_INSTANCE"
  | "APPEAL"
  | "CASSATION"
  | "CRIMINAL"
  | "SHARIA"
  | "ADMINISTRATIVE"
  | "OTHER"
  | "UNSPECIFIED";

export type DashboardCase = CaseRef & {
  status: CaseStatusKey;
  updatedAt: string;
  client: ClientRef | null;
};

export type DashboardDocument = {
  id: string;
  fileName: string;
  fileType: string;
  createdAt: string;
  case: CaseRef | null;
};

export type DashboardActivity = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  createdAt: string;
};

export type SubscriptionAlert = {
  kind: "TRIAL_ENDING" | "PAYMENT_FAILED" | "CANCELLING";
  daysLeft: number | null;
};

export type UsageMeter = { used: number; limit: number | null };

export type DashboardAccount = {
  planName: string;
  status: string;
  trialDaysLeft: number | null;
  periodEndsAt: string | null;
  users: UsageMeter;
  // Bytes used against the plan's storage, in MB.
  storageMb: UsageMeter;
  clients: UsageMeter;
  cases: UsageMeter;
  teamMembers: number;
  pendingInvitations: number;
};

export type DashboardData = {
  timeZone: string;
  generatedAt: string;
  role: DashboardRole;
  permissions: { canViewFinance: boolean; canManageBilling: boolean };

  kpis: {
    activeCases: number;
    totalCases: number;
    sessionsThisWeek: number;
    todayAppointments: number;
    overdueTasks: number;
    dueTodayTasks: number;
    newClientsThisMonth: number;
    totalClients: number;
    // null when the role cannot see finance.
    outstanding: number | null;
    collectedThisMonth: number | null;
    collectedChangePct: number | null;
  };

  attention: {
    overdueInvoices: { count: number; amount: number } | null;
    overdueTasks: number;
    sessionsWithin48h: number;
    staleCases: number;
    subscription: SubscriptionAlert | null;
  };

  agenda: AgendaItem[];
  agendaTotal: number;
  upcomingTasks: DashboardTask[];

  finance: { months: MonthTotals[]; aging: AgingBuckets } | null;
  casesByStatus: Array<{ status: CaseStatusKey; count: number }>;
  casesByCourt: Array<{ level: CourtLevel; count: number }>;

  recentCases: DashboardCase[];
  recentDocuments: DashboardDocument[];
  recentActivities: DashboardActivity[];

  account: DashboardAccount | null;
};
