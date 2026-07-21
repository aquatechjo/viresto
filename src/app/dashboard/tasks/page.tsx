"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import Modal from "@/components/ui/Modal";
import DateTimePicker from "@/components/ui/DateTimePicker";
import FormField from "@/components/ui/FormField";
import EmptyState from "@/components/ui/EmptyState";
import { VDSBadge, VDSCard, VDSGrid, type VDSTone } from "@/components/ui/vds";
import { VDSSearchInput } from "@/components/ui/vds/table";
import PageLoader from "@/components/ui/PageLoader";
import { formatDate } from "@/lib/utils";
import { translations, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/useLocale";
import SubscriptionReadOnlyBanner from "@/components/billing/SubscriptionReadOnlyBanner";
import { useTenantWriteAccess } from "@/hooks/useTenantWriteAccess";

interface Task {
  id: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority: string;
  status?: TaskStatus;
  completed: boolean;
  completedAt?: string | null;
  assignedTo?: TeamMember | null;
  createdBy?: TeamMember | null;
  client?: {
    id?: string;
    name: string;
    archivedAt?: string | null;
  } | null;
  case?: {
    id?: string;
    title: string;
    client?: {
      id?: string;
      name: string;
      archivedAt?: string | null;
    } | null;
  } | null;
}

type TaskStatus =
  "TODO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" | "CANCELLED";

interface TeamMember {
  id: string;
  name: string;
  role: "ADMIN" | "LAWYER" | "STAFF";
  isActive?: boolean;
}

interface ClientItem {
  id: string;
  name: string;
}

interface CaseItem {
  id: string;
  title: string;
  client?: {
    id?: string;
    name?: string;
  } | null;
}

interface EditTaskFormState {
  title: string;
  description: string;
  dueDate: string;
  priority: string;
  status: TaskStatus;
  clientId: string;
  caseId: string;
  assignedToId: string;
}

const PRIORITY_LABELS: Record<Locale, Record<string, string>> = {
  ar: {
    URGENT: "عاجلة",
    HIGH: "عالية",
    MEDIUM: "متوسطة",
    LOW: "منخفضة",
  },
  en: {
    URGENT: "Urgent",
    HIGH: "High",
    MEDIUM: "Medium",
    LOW: "Low",
  },
};

const STATUS_LABELS: Record<Locale, Record<TaskStatus, string>> = {
  ar: {
    TODO: "جديدة",
    IN_PROGRESS: "قيد التنفيذ",
    BLOCKED: "متوقفة",
    COMPLETED: "مكتملة",
    CANCELLED: "ملغاة",
  },
  en: {
    TODO: "New",
    IN_PROGRESS: "In progress",
    BLOCKED: "Blocked",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  },
};

const INIT = {
  title: "",
  description: "",
  dueDate: "",
  priority: "MEDIUM",
  clientId: "",
  caseId: "",
  assignedToId: "",
};

const EDIT_INIT: EditTaskFormState = {
  title: "",
  description: "",
  dueDate: "",
  priority: "MEDIUM",
  status: "TODO",
  clientId: "",
  caseId: "",
  assignedToId: "",
};

function toDateTimeLocalValue(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function priorityTone(priority: string): VDSTone {
  switch (priority) {
    case "URGENT":
    case "HIGH":
      return "red";
    case "MEDIUM":
      return "gold";
    case "LOW":
      return "slate";
    default:
      return "slate";
  }
}

function taskStatusTone(status: TaskStatus): VDSTone {
  switch (status) {
    case "COMPLETED":
      return "emerald";
    case "IN_PROGRESS":
      return "blue";
    case "BLOCKED":
      return "gold";
    case "CANCELLED":
      return "red";
    default:
      return "slate";
  }
}

function statusBadgeStyle(status: TaskStatus) {
  switch (status) {
    case "COMPLETED":
      return {
        background: "var(--green-soft)",
        color: "var(--text)",
        borderColor: "var(--border)",
      };
    case "IN_PROGRESS":
      return {
        background: "rgba(59, 130, 246, 0.14)",
        color: "var(--text)",
        borderColor: "rgba(29, 78, 216, 0.2)",
      };
    case "BLOCKED":
      return {
        background: "var(--amber-soft, rgba(245, 158, 11, 0.14))",
        color: "var(--text)",
        borderColor: "rgba(194, 65, 12, 0.2)",
      };
    case "CANCELLED":
      return {
        background: "var(--red-soft)",
        color: "var(--text)",
        borderColor: "rgba(220, 38, 38, 0.2)",
      };
    default:
      return {
        background: "var(--card-2)",
        color: "var(--text)",
        borderColor: "var(--border)",
      };
  }
}

const TASK_TRANSLATIONS = {
  ar: {
    hero: {
      badge: "إدارة العمل اليومي",
      title: "المهام",
      subtitle:
        "تابع المهام المرتبطة بالقضايا والموكلين، وحدد الأولويات والمواعيد النهائية لضمان عدم تفويت أي إجراء مهم.",
    },
    actions: {
      newTask: "+ مهمة جديدة",
      addTask: "+ إضافة مهمة",
      deleteTask: "حذف المهمة",
      deleting: "جاري الحذف...",
    },
    stats: {
      total: "كل المهام",
      pending: "معلقة",
      done: "منتهية",
      overdue: "متأخرة",
    },
    filters: {
      searchAria: "البحث في المهام",
      searchPlaceholder: "ابحث في العنوان، الوصف، الموكل أو القضية...",
      priorityAria: "فلترة حسب الأولوية",
      clientAria: "فلترة حسب الموكل",
      caseAria: "فلترة حسب القضية",
      allPriorities: "جميع الأولويات",
      allClients: "جميع الموكلين",
      allCases: "جميع القضايا",
      apply: "بحث",
      clear: "مسح الفلاتر",
      chips: { all: "الكل", pending: "معلقة", done: "منتهية" },
    },
    status: { pending: "معلقة", done: "منتهية" },
    empty: {
      title: "لا توجد مهام",
      first: "أضف أول مهمة لتنظيم العمل داخل المكتب.",
      filtered: "لا توجد نتائج مطابقة للفلاتر الحالية.",
    },
    card: { toggleAria: "تغيير حالة المهمة", archivedClient: "موكل مؤرشف" },
    modal: {
      createTitle: "إضافة مهمة جديدة",
      deleteTitle: "تأكيد حذف المهمة",
      deleteMessage:
        "هل أنت متأكد من حذف هذه المهمة؟ لا يمكن التراجع عن هذا الإجراء.",
    },
    form: {
      title: "عنوان المهمة",
      description: "الوصف",
      priority: "الأولوية",
      dueDate: "الموعد النهائي",
      client: "الموكل",
      case: "القضية",
      noClient: "بدون موكل",
      noCase: "بدون قضية",
    },
    messages: {
      loadError: "فشل تحميل المهام",
      updateError: "فشل تحديث المهمة",
      updateUnexpectedError: "حدث خطأ أثناء تحديث المهمة",
      completedSuccess: "تم إنجاز المهمة",
      reopenedSuccess: "تم إعادة المهمة",
      completedLocked: "المهمة مكتملة ولا يمكن تغيير حالتها بعد الآن",
      deleteError: "فشل حذف المهمة",
      deleteSuccess: "تم حذف المهمة",
      deleteUnexpectedError: "حدث خطأ أثناء حذف المهمة",
      titleRequired: "العنوان مطلوب",
      createError: "فشل إضافة المهمة",
      createSuccess: "تمت إضافة المهمة",
      createUnexpectedError: "حدث خطأ أثناء إضافة المهمة",
      archivedDeleteBlocked: "لا يمكن حذف مهمة مرتبطة بموكل مؤرشف",
    },
  },
  en: {
    hero: {
      badge: "Daily work management",
      title: "Tasks",
      subtitle:
        "Track tasks linked to cases and clients, set priorities and deadlines, and avoid missing any important action.",
    },
    actions: {
      newTask: "+ New task",
      addTask: "+ Add task",
      deleteTask: "Delete task",
      deleting: "Deleting...",
    },
    stats: {
      total: "All tasks",
      pending: "Pending",
      done: "Completed",
      overdue: "Overdue",
    },
    filters: {
      searchAria: "Search tasks",
      searchPlaceholder: "Search by title, description, client, or case...",
      priorityAria: "Filter by priority",
      clientAria: "Filter by client",
      caseAria: "Filter by case",
      allPriorities: "All priorities",
      allClients: "All clients",
      allCases: "All cases",
      apply: "Filter",
      clear: "Clear filters",
      chips: { all: "All", pending: "Pending", done: "Completed" },
    },
    status: { pending: "Pending", done: "Completed" },
    empty: {
      title: "No tasks",
      first: "Add the first task to organize the office workflow.",
      filtered: "No tasks match the current filters.",
    },
    card: {
      toggleAria: "Change task status",
      archivedClient: "Archived client",
    },
    modal: {
      createTitle: "Add new task",
      deleteTitle: "Confirm task deletion",
      deleteMessage:
        "Are you sure you want to delete this task? This action cannot be undone.",
    },
    form: {
      title: "Task title",
      description: "Description",
      priority: "Priority",
      dueDate: "Due date",
      client: "Client",
      case: "Case",
      noClient: "No client",
      noCase: "No case",
    },
    messages: {
      loadError: "Failed to load tasks",
      updateError: "Failed to update task",
      updateUnexpectedError: "An error occurred while updating the task",
      completedSuccess: "Task completed",
      reopenedSuccess: "Task reopened",
      completedLocked: "This task is completed and its status is now locked",
      deleteError: "Failed to delete task",
      deleteSuccess: "Task deleted",
      deleteUnexpectedError: "An error occurred while deleting the task",
      titleRequired: "Title is required",
      createError: "Failed to add task",
      createSuccess: "Task added",
      createUnexpectedError: "An error occurred while adding the task",
      archivedDeleteBlocked:
        "Cannot delete a task linked to an archived client",
    },
  },
};

export default function TasksPage() {
  const localeState = useLocale() as {
    locale?: Locale;
    t?: typeof translations.ar;
  };
  const locale = localeState?.locale === "en" ? "en" : "ar";
  const t = localeState?.t ?? translations[locale] ?? translations.ar;
  const tAny = t as {
    tasks?: typeof TASK_TRANSLATIONS.ar;
    common?: typeof translations.ar.common;
  };
  const taskCopy = tAny.tasks?.messages
    ? tAny.tasks
    : TASK_TRANSLATIONS[locale];
  const common = tAny.common ?? translations.ar.common;
  const isRtl = locale === "ar";
  const priorityLabels = PRIORITY_LABELS[locale] ?? PRIORITY_LABELS.ar;
  const statusLabels = STATUS_LABELS[locale] ?? STATUS_LABELS.ar;
  const fieldProps = {
    dir: isRtl ? "rtl" : "ltr",
    style: {
      textAlign: isRtl ? "right" : "left",
      direction: isRtl ? "rtl" : "ltr",
    } as React.CSSProperties,
  };
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(INIT);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState<EditTaskFormState>(EDIT_INIT);
  const [editSaving, setEditSaving] = useState(false);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentRole, setCurrentRole] = useState<TeamMember["role"]>("STAFF");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [caseFilter, setCaseFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [stats, setStats] = useState({ total: 0, pending: 0, done: 0, overdue: 0 });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const writeAccess = useTenantWriteAccess(locale);

  const isArchivedTask = useCallback((task: Task) => {
    return Boolean(task.client?.archivedAt || task.case?.client?.archivedAt);
  }, []);

  const getTaskStatus = useCallback(
    (task: Task): TaskStatus =>
      task.status ?? (task.completed ? "COMPLETED" : "TODO"),
    [],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, priorityFilter, clientFilter, caseFilter, assigneeFilter, filter]);

  const loadOptions = useCallback(async () => {
    try {
      const [clientsRes, casesRes, membersRes] = await Promise.all([
        fetch("/api/clients?limit=100"),
        fetch("/api/cases?limit=100"),
        fetch("/api/team?mode=assignees"),
      ]);
      const [clientsData, casesData, membersData] = await Promise.all([
        clientsRes.json(), casesRes.json(), membersRes.json(),
      ]);
      setClients(
        Array.isArray(clientsData.data?.data) ? clientsData.data.data : [],
      );
      setCases(Array.isArray(casesData.data?.data) ? casesData.data.data : []);
      const loadedMembers = Array.isArray(membersData.data?.members)
        ? membersData.data.members
        : [];
      const loadedCurrentUserId = String(membersData.data?.currentUserId ?? "");
      const loadedCurrentRole = membersData.data?.currentRole;

      setMembers(loadedMembers);
      setCurrentUserId(loadedCurrentUserId);
      setCurrentRole(
        loadedCurrentRole === "ADMIN" || loadedCurrentRole === "LAWYER"
          ? loadedCurrentRole
          : "STAFF",
      );
      setForm((previous) => ({
        ...previous,
        assignedToId: previous.assignedToId || loadedCurrentUserId,
      }));
    } catch {
      setClients([]);
      setCases([]);
      setMembers([]);
    }
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const load = useCallback(async () => {
    const controller = new AbortController();
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: "20", scope: filter });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (clientFilter !== "all") params.set("clientId", clientFilter);
      if (caseFilter !== "all") params.set("caseId", caseFilter);
      if (assigneeFilter !== "all") params.set("assignedToId", assigneeFilter);
      const response = await fetch(`/api/tasks?${params}`, { signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error();
      setTasks(Array.isArray(payload.data?.data) ? payload.data.data : []);
      setPagination(payload.data?.pagination ?? { page, total: 0, totalPages: 1 });
      setStats(payload.data?.stats ?? { total: 0, pending: 0, done: 0, overdue: 0 });
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        toast.error(taskCopy.messages.loadError);
        setTasks([]);
      }
    } finally {
      setLoading(false);
    }
    return () => controller.abort();
  }, [assigneeFilter, caseFilter, clientFilter, debouncedSearch, filter, page, priorityFilter, taskCopy.messages.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  const now = useMemo(() => new Date(), []);
  const isOverdue = useCallback((task: Task) => {
    const status = getTaskStatus(task);
    return status !== "COMPLETED" && status !== "CANCELLED" && !!task.dueDate && new Date(task.dueDate) < now;
  }, [getTaskStatus, now]);

  const isSoon = useCallback((task: Task) => {
    const status = getTaskStatus(task);
    if (status === "COMPLETED" || status === "CANCELLED") return false;
    if (isOverdue(task) || !task.dueDate) return false;
    return new Date(task.dueDate).getTime() - now.getTime() < 3 * 86400000;
  }, [getTaskStatus, isOverdue, now]);

  const { total, pending, done, overdue } = stats;

  async function updateStatus(id: string, status: TaskStatus) {
    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || taskCopy.messages.updateError);
      return;
    }

    const currentTask = tasks.find((task) => task.id === id);

    if (
      currentTask &&
      getTaskStatus(currentTask) === "COMPLETED" &&
      status !== "COMPLETED"
    ) {
      toast.warning(taskCopy.messages.completedLocked);
      return;
    }

    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        toast.error(data.message ?? taskCopy.messages.updateError);
        return;
      }

      await load();

      toast.success(
        status === "COMPLETED"
          ? taskCopy.messages.completedSuccess
          : locale === "ar"
            ? "تم تحديث حالة المهمة"
            : "Task status updated",
      );
    } catch {
      toast.error(taskCopy.messages.updateUnexpectedError);
    }
  }

  async function toggle(task: Task) {
    if (getTaskStatus(task) === "COMPLETED") {
      toast.warning(taskCopy.messages.completedLocked);
      return;
    }

    await updateStatus(task.id, "COMPLETED");
  }

  function del(id: string) {
    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || taskCopy.messages.deleteError);
      return;
    }

    setDeleteId(id);
  }

  async function confirmDelete() {
    if (!deleteId) return;

    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || taskCopy.messages.deleteError);
      return;
    }

    try {
      setDeleteLoading(true);

      const response = await fetch(`/api/tasks/${deleteId}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data.message ?? taskCopy.messages.deleteError);
        return;
      }

      toast.success(taskCopy.messages.deleteSuccess);
      setDeleteId(null);
      load();
    } catch {
      toast.error(taskCopy.messages.deleteUnexpectedError);
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();

    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || taskCopy.messages.createError);
      return;
    }

    if (!form.title.trim()) {
      toast.error(taskCopy.messages.titleRequired);
      return;
    }

    try {
      setSaving(true);

      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          dueDate: form.dueDate
            ? new Date(form.dueDate).toISOString()
            : undefined,
          clientId: form.clientId || undefined,
          caseId: form.caseId || undefined,
          assignedToId: form.assignedToId || currentUserId,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        toast.error(data.message ?? taskCopy.messages.createError);
        return;
      }

      toast.success(taskCopy.messages.createSuccess);
      setOpen(false);
      setForm({ ...INIT, assignedToId: currentUserId });
      load();
    } catch {
      toast.error(taskCopy.messages.createUnexpectedError);
    } finally {
      setSaving(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setPriorityFilter("all");
    setClientFilter("all");
    setCaseFilter("all");
    setAssigneeFilter("all");
    setFilter("all");
    setPage(1);
  }

  function openCreateTaskModal() {
    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || taskCopy.messages.createError);
      return;
    }

    setForm((previous) => ({
      ...previous,
      assignedToId: previous.assignedToId || currentUserId,
    }));
    setOpen(true);
  }

  function closeEditTaskModal() {
    setEditOpen(false);
    setEditingTask(null);
    setEditForm(EDIT_INIT);
  }

  function openEditTaskModal(task: Task) {
    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || taskCopy.messages.updateError);
      return;
    }

    if (currentRole === "STAFF") {
      toast.warning(
        locale === "ar"
          ? "الموظف يستطيع تحديث حالة المهمة فقط"
          : "Staff can update task status only",
      );
      return;
    }

    if (isArchivedTask(task)) {
      toast.warning(
        locale === "ar"
          ? "لا يمكن تعديل مهمة مرتبطة بموكل مؤرشف"
          : "A task linked to an archived client cannot be edited",
      );
      return;
    }

    setEditingTask(task);
    setEditForm({
      title: task.title ?? "",
      description: task.description ?? "",
      dueDate: toDateTimeLocalValue(task.dueDate),
      priority: task.priority || "MEDIUM",
      status: getTaskStatus(task),
      clientId: task.client?.id ?? task.case?.client?.id ?? "",
      caseId: task.case?.id ?? "",
      assignedToId: task.assignedTo?.id ?? currentUserId,
    });
    setEditOpen(true);
  }

  async function handleEdit(event: React.FormEvent) {
    event.preventDefault();

    if (!editingTask) return;

    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || taskCopy.messages.updateError);
      return;
    }

    if (currentRole === "STAFF") {
      toast.warning(
        locale === "ar"
          ? "الموظف يستطيع تحديث حالة المهمة فقط"
          : "Staff can update task status only",
      );
      return;
    }

    if (!editForm.title.trim()) {
      toast.error(taskCopy.messages.titleRequired);
      return;
    }

    if (!editForm.assignedToId) {
      toast.error(
        locale === "ar"
          ? "المسؤول عن المهمة مطلوب"
          : "Task assignee is required",
      );
      return;
    }

    try {
      setEditSaving(true);

      const response = await fetch(`/api/tasks/${editingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title.trim(),
          description: editForm.description.trim(),
          priority: editForm.priority,
          status:
            getTaskStatus(editingTask) === "COMPLETED"
              ? "COMPLETED"
              : editForm.status,
          dueDate: editForm.dueDate
            ? new Date(editForm.dueDate).toISOString()
            : null,
          assignedToId: editForm.assignedToId,
          clientId: editForm.clientId || null,
          caseId: editForm.caseId || null,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        toast.error(data.message ?? taskCopy.messages.updateError);
        return;
      }

      await load();
      toast.success(locale === "ar" ? "تم تعديل المهمة" : "Task updated");
      closeEditTaskModal();
    } catch {
      toast.error(taskCopy.messages.updateUnexpectedError);
    } finally {
      setEditSaving(false);
    }
  }

  const editCases = editForm.clientId
    ? cases.filter(
        (caseItem) =>
          !caseItem.client?.id || caseItem.client.id === editForm.clientId,
      )
    : cases;

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-5 stagger">
      <SubscriptionReadOnlyBanner
        visible={!writeAccess.canWrite}
        message={writeAccess.message}
        isRtl={isRtl}
      />

      {/* Header */}
      <div
        className="relative overflow-hidden rounded-[28px] border p-6 text-start"
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

        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div
              className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
              style={{
                background: "rgba(255,255,255,0.14)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              {taskCopy.hero.badge}
            </div>

            <h1 className="text-2xl font-black text-white">
              {taskCopy.hero.title}
            </h1>

            <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
              {taskCopy.hero.subtitle}
            </p>
          </div>

          <button
            onClick={openCreateTaskModal}
            disabled={!writeAccess.canWrite}
            title={
              !writeAccess.canWrite
                ? writeAccess.message || taskCopy.messages.createError
                : taskCopy.actions.newTask
            }
            className="btn shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: "#fff",
              color: "var(--sidebar)",
              borderColor: "rgba(255,255,255,0.32)",
            }}
          >
            {taskCopy.actions.newTask}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: taskCopy.stats.total,
            value: total,
            color: "var(--text)",
            bg: "var(--card)",
          },
          {
            label: taskCopy.stats.pending,
            value: pending,
            color: "var(--text)",
            bg: "var(--green-soft)",
          },
          {
            label: taskCopy.stats.done,
            value: done,
            color: "var(--text-2)",
            bg: "var(--card)",
          },
          {
            label: taskCopy.stats.overdue,
            value: overdue,
            color: "#dc2626",
            bg: "var(--red-soft)",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="card p-5 text-start"
            style={{
              background: item.bg,
              borderColor: "var(--border)",
            }}
          >
            <p className="text-xs font-black" style={{ color: item.color }}>
              {item.label}
            </p>

            <p
              className="mt-2 text-3xl font-black"
              style={{ color: item.color }}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4" dir={isRtl ? "rtl" : "ltr"}>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_.7fr_.7fr_.7fr_.7fr_auto]">
          <VDSSearchInput
            aria-label={taskCopy.filters.searchAria}
            value={search}
            onChange={setSearch}
            placeholder={taskCopy.filters.searchPlaceholder}
            clearLabel={isRtl ? "مسح البحث" : "Clear search"}
            {...fieldProps}
          />

          <select
            aria-label={taskCopy.filters.priorityAria}
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            className="input h-12"
            {...fieldProps}
          >
            <option value="all" dir={isRtl ? "rtl" : "ltr"}>
              {taskCopy.filters.allPriorities}
            </option>
            <option value="URGENT" dir={isRtl ? "rtl" : "ltr"}>
              {priorityLabels.URGENT}
            </option>
            <option value="HIGH" dir={isRtl ? "rtl" : "ltr"}>
              {priorityLabels.HIGH}
            </option>
            <option value="MEDIUM" dir={isRtl ? "rtl" : "ltr"}>
              {priorityLabels.MEDIUM}
            </option>
            <option value="LOW" dir={isRtl ? "rtl" : "ltr"}>
              {priorityLabels.LOW}
            </option>
          </select>

          <select
            aria-label={
              locale === "ar" ? "فلترة حسب المسؤول" : "Filter by assignee"
            }
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
            className="input h-12"
            {...fieldProps}
          >
            <option value="all">
              {locale === "ar" ? "جميع المسؤولين" : "All assignees"}
            </option>
            <option value="me">{locale === "ar" ? "مهامي" : "My tasks"}</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>

          <select
            aria-label={taskCopy.filters.clientAria}
            value={clientFilter}
            onChange={(event) => setClientFilter(event.target.value)}
            className="input h-12"
            {...fieldProps}
          >
            <option value="all" dir={isRtl ? "rtl" : "ltr"}>
              {taskCopy.filters.allClients}
            </option>
            {clients.map((client) => (
              <option
                key={client.id}
                value={client.id}
                dir={isRtl ? "rtl" : "ltr"}
              >
                {client.name}
              </option>
            ))}
          </select>

          <select
            aria-label={taskCopy.filters.caseAria}
            value={caseFilter}
            onChange={(event) => setCaseFilter(event.target.value)}
            className="input h-12"
            {...fieldProps}
          >
            <option value="all" dir={isRtl ? "rtl" : "ltr"}>
              {taskCopy.filters.allCases}
            </option>
            {cases.map((caseItem) => (
              <option
                key={caseItem.id}
                value={caseItem.id}
                dir={isRtl ? "rtl" : "ltr"}
              >
                {caseItem.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-2xl border px-5 text-sm font-black transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c47a31]"
            style={{
              background: "var(--card-2)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          >
            {taskCopy.filters.clear}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ["all", taskCopy.filters.chips.all],
              ["pending", taskCopy.filters.chips.pending],
              ["done", taskCopy.filters.chips.done],
            ] as ["all" | "pending" | "done", string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="rounded-2xl px-4 py-2 text-xs font-black transition-all"
              style={
                filter === key
                  ? {
                      background: "var(--sidebar)",
                      color: "#fff",
                    }
                  : {
                      background: "var(--green-soft)",
                      color: "var(--text-2)",
                    }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <PageLoader />
      ) : tasks.length === 0 ? (
        <VDSCard padded={false} className="p-8">
          <EmptyState
            icon="✅"
            title={taskCopy.empty.title}
            sub={
              stats.total === 0
                ? taskCopy.empty.first
                : taskCopy.empty.filtered
            }
            action={
              stats.total === 0 ? (
                <button
                  onClick={openCreateTaskModal}
                  disabled={!writeAccess.canWrite}
                  title={
                    !writeAccess.canWrite
                      ? writeAccess.message || taskCopy.messages.createError
                      : taskCopy.actions.addTask
                  }
                  className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {taskCopy.actions.addTask}
                </button>
              ) : (
                <button onClick={clearFilters} className="btn btn-ghost">
                  {taskCopy.filters.clear}
                </button>
              )
            }
          />
        </VDSCard>
      ) : (
        <VDSGrid columns={2}>
          {tasks.map((task) => {
            const archivedTask = isArchivedTask(task);
            const taskStatus = getTaskStatus(task);
            const statusStyle = statusBadgeStyle(taskStatus);
            const canUpdateStatus =
              writeAccess.canWrite &&
              taskStatus !== "COMPLETED" &&
              (currentRole !== "STAFF" ||
                task.assignedTo?.id === currentUserId);
            const canManageTask =
              writeAccess.canWrite && currentRole !== "STAFF" && !archivedTask;

            return (
              <VDSCard
                key={task.id}
                as="article"
                interactive
                padded={false}
                className={`group flex h-full flex-col overflow-hidden text-start ${
                  taskStatus === "CANCELLED" ? "opacity-70" : ""
                }`}
              >
                <div className="flex-1 p-5">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      aria-label={taskCopy.card.toggleAria}
                      onClick={() => toggle(task)}
                      disabled={!canUpdateStatus}
                      title={
                        taskStatus === "COMPLETED"
                          ? taskCopy.messages.completedLocked
                          : !writeAccess.canWrite
                            ? writeAccess.message ||
                              taskCopy.messages.updateError
                            : taskCopy.card.toggleAria
                      }
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black transition-all disabled:cursor-not-allowed ${
                        taskStatus === "COMPLETED" ? "" : "disabled:opacity-40"
                      }`}
                      style={{
                        borderColor:
                          taskStatus === "COMPLETED"
                            ? "var(--sidebar-hover)"
                            : "var(--text-3)",
                        background:
                          taskStatus === "COMPLETED"
                            ? "var(--sidebar)"
                            : "transparent",
                        color: "var(--sidebar-text)",
                      }}
                    >
                      {taskStatus === "COMPLETED" ? "✓" : null}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2
                          className="min-w-0 flex-1 text-base font-black leading-7"
                          style={{ color: "var(--text)" }}
                        >
                          {task.title}
                        </h2>

                        <VDSBadge
                          tone={priorityTone(task.priority)}
                          className="shrink-0"
                        >
                          {priorityLabels[task.priority] ?? task.priority}
                        </VDSBadge>

                        <VDSBadge
                          tone={taskStatusTone(taskStatus)}
                          className="shrink-0"
                        >
                          {statusLabels[taskStatus]}
                        </VDSBadge>
                      </div>

                      {task.description && (
                        <p
                          className="mt-2 line-clamp-2 text-xs font-semibold leading-5"
                          style={{ color: "var(--text-3)" }}
                        >
                          {task.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <TaskMeta
                      label={locale === "ar" ? "الموعد النهائي" : "Due date"}
                      value={
                        task.dueDate
                          ? formatDate(task.dueDate, {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : locale === "ar"
                            ? "غير محدد"
                            : "Not set"
                      }
                      icon="📅"
                      danger={isOverdue(task)}
                      warning={isSoon(task)}
                    />

                    <TaskMeta
                      label={locale === "ar" ? "المسؤول" : "Assignee"}
                      value={
                        task.assignedTo?.name ||
                        (locale === "ar" ? "غير محدد" : "Unassigned")
                      }
                      icon="👤"
                    />

                    <TaskMeta
                      label={taskCopy.form.client}
                      value={
                        task.client?.name ||
                        task.case?.client?.name ||
                        taskCopy.form.noClient
                      }
                      icon="👥"
                    />

                    <TaskMeta
                      label={taskCopy.form.case}
                      value={task.case?.title || taskCopy.form.noCase}
                      icon="⚖️"
                    />
                  </div>

                  {archivedTask ? (
                    <div className="mt-3">
                      <VDSBadge tone="gold">
                        {taskCopy.card.archivedClient}
                      </VDSBadge>
                    </div>
                  ) : null}
                </div>

                <div
                  className="flex flex-col gap-3 border-t px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--card-2)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    {currentRole !== "STAFF" && (
                      <button
                        type="button"
                        onClick={() => openEditTaskModal(task)}
                        disabled={!canManageTask}
                        title={
                          archivedTask
                            ? locale === "ar"
                              ? "لا يمكن تعديل مهمة مرتبطة بموكل مؤرشف"
                              : "Archived-client tasks cannot be edited"
                            : locale === "ar"
                              ? "تعديل المهمة"
                              : "Edit task"
                        }
                        className="btn btn-ghost h-9 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ✏️ {locale === "ar" ? "تعديل" : "Edit"}
                      </button>
                    )}

                    {currentRole !== "STAFF" && (
                      <button
                        type="button"
                        onClick={() => del(task.id)}
                        disabled={!canManageTask}
                        title={
                          archivedTask
                            ? taskCopy.messages.archivedDeleteBlocked
                            : taskCopy.actions.deleteTask
                        }
                        className="h-9 rounded-xl border border-red-500/20 px-4 text-xs font-black text-red-500 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        🗑 {locale === "ar" ? "حذف" : "Delete"}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-black"
                      style={{ color: "var(--text-3)" }}
                    >
                      {locale === "ar" ? "الحالة" : "Status"}
                    </span>
                    {taskStatus === "COMPLETED" ? (
                      <span
                        className="inline-flex min-h-9 min-w-[130px] items-center justify-center rounded-xl border px-3 py-2 text-xs font-black"
                        style={{
                          background: statusStyle.background,
                          color: statusStyle.color,
                          borderColor: statusStyle.borderColor,
                        }}
                        title={taskCopy.messages.completedLocked}
                      >
                        {statusLabels.COMPLETED}
                      </span>
                    ) : (
                      <select
                        aria-label={
                          locale === "ar" ? "حالة المهمة" : "Task status"
                        }
                        value={taskStatus}
                        onChange={(event) =>
                          updateStatus(
                            task.id,
                            event.target.value as TaskStatus,
                          )
                        }
                        disabled={!canUpdateStatus}
                        className="min-w-[130px] rounded-xl border px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50"
                        style={{
                          background: statusStyle.background,
                          color: statusStyle.color,
                          borderColor: statusStyle.borderColor,
                        }}
                      >
                        {(Object.keys(statusLabels) as TaskStatus[]).map(
                          (status) => (
                            <option key={status} value={status}>
                              {statusLabels[status]}
                            </option>
                          ),
                        )}
                      </select>
                    )}
                  </div>
                </div>
              </VDSCard>
            );
          })}
        </VDSGrid>
      )}

      {!loading && pagination.totalPages > 1 ? (
        <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold" style={{ color: "var(--text-3)" }}>
            {locale === "ar"
              ? `صفحة ${pagination.page} من ${pagination.totalPages} — ${pagination.total} مهمة`
              : `Page ${pagination.page} of ${pagination.totalPages} — ${pagination.total} tasks`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              {locale === "ar" ? "السابق" : "Previous"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))}
            >
              {locale === "ar" ? "التالي" : "Next"}
            </button>
          </div>
        </div>
      ) : null}

      {/* Add Modal */}
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setForm({ ...INIT, assignedToId: currentUserId });
        }}
        title={taskCopy.modal.createTitle}
        size="sm"
      >
        <form
          onSubmit={handleAdd}
          className="space-y-3"
          dir={isRtl ? "rtl" : "ltr"}
        >
          <FormField label={taskCopy.form.title} required>
            <input
              value={form.title}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  title: event.target.value,
                }))
              }
              className="input"
              autoFocus
              {...fieldProps}
            />
          </FormField>

          <FormField label={taskCopy.form.description}>
            <textarea
              aria-label={taskCopy.form.description}
              value={form.description}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
              className="input"
              rows={2}
              style={{ ...fieldProps.style, resize: "none" }}
              dir={fieldProps.dir}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={taskCopy.form.priority}>
              <select
                aria-label={taskCopy.form.priority}
                value={form.priority}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    priority: event.target.value,
                  }))
                }
                className="input"
                {...fieldProps}
              >
                {Object.entries(priorityLabels).map(([key, value]) => (
                  <option key={key} value={key} dir={isRtl ? "rtl" : "ltr"}>
                    {value}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label={taskCopy.form.dueDate}>
              <DateTimePicker
                value={form.dueDate}
                onChange={(value) =>
                  setForm((previous) => ({
                    ...previous,
                    dueDate: value,
                  }))
                }
                locale={locale}
                ariaLabel={taskCopy.form.dueDate}
              />
            </FormField>
          </div>

          <FormField
            label={locale === "ar" ? "المسؤول عن المهمة" : "Task assignee"}
            required
          >
            <select
              aria-label={
                locale === "ar" ? "المسؤول عن المهمة" : "Task assignee"
              }
              value={form.assignedToId}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  assignedToId: event.target.value,
                }))
              }
              disabled={currentRole === "STAFF"}
              className="input disabled:cursor-not-allowed disabled:opacity-70"
              {...fieldProps}
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} —{" "}
                  {member.role === "ADMIN"
                    ? locale === "ar"
                      ? "مدير النظام"
                      : "Admin"
                    : member.role === "LAWYER"
                      ? locale === "ar"
                        ? "محامٍ"
                        : "Lawyer"
                      : locale === "ar"
                        ? "موظف"
                        : "Staff"}
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={taskCopy.form.client}>
              <select
                aria-label={taskCopy.form.client}
                value={form.clientId}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    clientId: event.target.value,
                  }))
                }
                className="input"
                {...fieldProps}
              >
                <option value="" dir={isRtl ? "rtl" : "ltr"}>
                  {taskCopy.form.noClient}
                </option>

                {clients.map((client) => (
                  <option
                    key={client.id}
                    value={client.id}
                    dir={isRtl ? "rtl" : "ltr"}
                  >
                    {client.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label={taskCopy.form.case}>
              <select
                aria-label={taskCopy.form.case}
                value={form.caseId}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    caseId: event.target.value,
                  }))
                }
                className="input"
                {...fieldProps}
              >
                <option value="" dir={isRtl ? "rtl" : "ltr"}>
                  {taskCopy.form.noCase}
                </option>

                {cases.map((caseItem) => (
                  <option
                    key={caseItem.id}
                    value={caseItem.id}
                    dir={isRtl ? "rtl" : "ltr"}
                  >
                    {caseItem.title}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setForm({ ...INIT, assignedToId: currentUserId });
              }}
              className="btn btn-ghost flex-1"
            >
              {common.cancel}
            </button>

            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary flex-1"
            >
              {saving ? <span className="spinner spinner-sm" /> : common.save}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        onClose={closeEditTaskModal}
        title={locale === "ar" ? "تعديل المهمة" : "Edit task"}
        size="sm"
      >
        <form
          onSubmit={handleEdit}
          className="space-y-3"
          dir={isRtl ? "rtl" : "ltr"}
        >
          <FormField label={taskCopy.form.title} required>
            <input
              value={editForm.title}
              onChange={(event) =>
                setEditForm((previous) => ({
                  ...previous,
                  title: event.target.value,
                }))
              }
              className="input"
              autoFocus
              {...fieldProps}
            />
          </FormField>

          <FormField label={taskCopy.form.description}>
            <textarea
              aria-label={taskCopy.form.description}
              value={editForm.description}
              onChange={(event) =>
                setEditForm((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
              className="input"
              rows={3}
              style={{ ...fieldProps.style, resize: "none" }}
              dir={fieldProps.dir}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={taskCopy.form.priority}>
              <select
                value={editForm.priority}
                onChange={(event) =>
                  setEditForm((previous) => ({
                    ...previous,
                    priority: event.target.value,
                  }))
                }
                className="input"
                {...fieldProps}
              >
                {Object.entries(priorityLabels).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label={locale === "ar" ? "الحالة" : "Status"}>
              {editingTask && getTaskStatus(editingTask) === "COMPLETED" ? (
                <div
                  className="input flex items-center font-black"
                  style={{
                    ...fieldProps.style,
                    color: "var(--text)",
                  }}
                  title={taskCopy.messages.completedLocked}
                >
                  {statusLabels.COMPLETED}
                </div>
              ) : (
                <select
                  value={editForm.status}
                  onChange={(event) =>
                    setEditForm((previous) => ({
                      ...previous,
                      status: event.target.value as TaskStatus,
                    }))
                  }
                  className="input"
                  {...fieldProps}
                >
                  {(Object.keys(statusLabels) as TaskStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          </div>

          <FormField label={taskCopy.form.dueDate}>
            <DateTimePicker
              value={editForm.dueDate}
              onChange={(value) =>
                setEditForm((previous) => ({
                  ...previous,
                  dueDate: value,
                }))
              }
              locale={locale}
              ariaLabel={taskCopy.form.dueDate}
            />
          </FormField>

          <FormField
            label={locale === "ar" ? "المسؤول عن المهمة" : "Task assignee"}
            required
          >
            <select
              value={editForm.assignedToId}
              onChange={(event) =>
                setEditForm((previous) => ({
                  ...previous,
                  assignedToId: event.target.value,
                }))
              }
              className="input"
              {...fieldProps}
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={taskCopy.form.client}>
              <select
                value={editForm.clientId}
                onChange={(event) => {
                  const clientId = event.target.value;
                  const selectedCase = cases.find(
                    (caseItem) => caseItem.id === editForm.caseId,
                  );

                  setEditForm((previous) => ({
                    ...previous,
                    clientId,
                    caseId:
                      selectedCase?.client?.id &&
                      selectedCase.client.id !== clientId
                        ? ""
                        : previous.caseId,
                  }));
                }}
                className="input"
                {...fieldProps}
              >
                <option value="">{taskCopy.form.noClient}</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label={taskCopy.form.case}>
              <select
                value={editForm.caseId}
                onChange={(event) => {
                  const caseId = event.target.value;
                  const selectedCase = cases.find(
                    (caseItem) => caseItem.id === caseId,
                  );

                  setEditForm((previous) => ({
                    ...previous,
                    caseId,
                    clientId: selectedCase?.client?.id || previous.clientId,
                  }));
                }}
                className="input"
                {...fieldProps}
              >
                <option value="">{taskCopy.form.noCase}</option>
                {editCases.map((caseItem) => (
                  <option key={caseItem.id} value={caseItem.id}>
                    {caseItem.title}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={closeEditTaskModal}
              className="btn btn-ghost flex-1"
            >
              {common.cancel}
            </button>

            <button
              type="submit"
              disabled={editSaving}
              className="btn btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {editSaving ? (
                <span className="spinner spinner-sm" />
              ) : locale === "ar" ? (
                "حفظ التعديل"
              ) : (
                "Save changes"
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title={taskCopy.modal.deleteTitle}
        size="sm"
      >
        <div className="space-y-4 text-start" dir={isRtl ? "rtl" : "ltr"}>
          <p className="text-sm" style={{ color: "var(--text-2)" }}>
            {taskCopy.modal.deleteMessage}
          </p>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDeleteId(null)}
              className="btn btn-ghost flex-1"
            >
              {common.cancel}
            </button>

            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleteLoading}
              className="btn flex-1 bg-red-600 text-white hover:bg-red-700"
            >
              {deleteLoading ? taskCopy.actions.deleting : common.delete}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TaskMeta({
  label,
  value,
  icon,
  danger = false,
  warning = false,
}: {
  label: string;
  value: string;
  icon: string;
  danger?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className="min-w-0 rounded-2xl border px-3 py-2.5"
      style={{
        background: danger
          ? "var(--red-soft)"
          : warning
            ? "var(--amber-soft, rgba(245, 158, 11, 0.14))"
            : "var(--card-2)",
        borderColor: danger
          ? "rgba(220, 38, 38, 0.18)"
          : warning
            ? "rgba(217, 119, 6, 0.18)"
            : "var(--border)",
      }}
    >
      <p
        className="text-[10px] font-black"
        style={{
          color: danger || warning ? "var(--text-2)" : "var(--text-3)",
        }}
      >
        {label}
      </p>
      <p
        className="mt-1 truncate text-xs font-black"
        style={{
          color: "var(--text)",
        }}
        title={value}
      >
        <span aria-hidden="true">{icon}</span> {value}
      </p>
    </div>
  );
}
