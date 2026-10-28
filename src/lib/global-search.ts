import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Locale } from "@/lib/i18n";
import {
  buildAppointmentAccessWhere,
  buildCaseAccessWhere,
  buildClientAccessWhere,
  buildDocumentAccessWhere,
  buildInvoiceAccessWhere,
  buildPaymentAccessWhere,
  buildTaskAccessWhere,
  type AccessControlUser,
} from "@/lib/access-control";
import {
  decryptText,
  hashSearchValue,
  normalizeEmail,
  normalizePhone,
} from "@/lib/encryption";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { formatJOD } from "@/lib/money";
import {
  containsNormalized,
  searchableFields,
  type PreparedQuery,
} from "@/lib/search-normalize";

// Dashboard-wide search behind the top bar (GET /api/search).
//
// Each type runs in two steps. Step 1 is raw SQL scoped to the office
// (tenantId) that folds Arabic on both sides and returns candidate ids.
// Step 2 is a normal Prisma query that applies the same access-control
// helpers as the rest of the API (role, assigned cases) and loads what the
// result row shows. Access rules therefore live only in access-control.ts.

export const SEARCH_RESULTS_PER_TYPE = 5;

// Step 1 returns at most this many ids per type. For an admin step 2 keeps
// the newest 5 of them; a lawyer or staff member whose office has more
// matches than this outside their cases may see fewer than 5.
const CANDIDATE_LIMIT = 100;

export const SEARCH_GROUPS = [
  "clients",
  "cases",
  "invoices",
  "payments",
  "documents",
  "appointments",
  "tasks",
  "team",
] as const;

export type SearchGroup = (typeof SEARCH_GROUPS)[number];

export interface SearchResultItem {
  id: string;
  title: string;
  /** Data shown under the title, joined with " · " by the UI. */
  meta: string[];
  href: string;
  /** Short status code the UI translates (e.g. "ARCHIVED", a role). */
  badge?: string;
}

export type SearchResults = Record<SearchGroup, SearchResultItem[]>;

export function emptySearchResults(): SearchResults {
  return {
    clients: [],
    cases: [],
    invoices: [],
    payments: [],
    documents: [],
    appointments: [],
    tasks: [],
    team: [],
  };
}

async function candidateIds(query: Prisma.Sql) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(query);
  return rows.map((row) => row.id);
}

function compact(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value && value.trim()));
}

function publicIdMatch(q: PreparedQuery) {
  return q.number ? [{ publicId: q.number }] : [];
}

async function searchClients(user: AccessControlUser, q: PreparedQuery) {
  const ids = await candidateIds(Prisma.sql`
    SELECT c."id" FROM "Client" c
    WHERE c."tenantId" = ${user.tenantId}
      AND ${containsNormalized(Prisma.sql`c."name"`, q.needle)}
    ORDER BY c."updatedAt" DESC
    LIMIT ${CANDIDATE_LIMIT}
  `);

  // Phone, national ID and email are encrypted: only an exact full value
  // matches, through its HMAC hash. Staff never see these fields, so they
  // can't search by them either.
  const canSeeContact = user.role !== "STAFF";
  const phone = canSeeContact ? normalizePhone(q.raw) : null;
  const email = canSeeContact ? normalizeEmail(q.raw) : null;
  const hashMatches: Prisma.ClientWhereInput[] = canSeeContact
    ? [
        ...(phone ? [{ phoneHash: hashSearchValue(phone) }] : []),
        ...(email ? [{ emailHash: hashSearchValue(email) }] : []),
        { nationalIdHash: hashSearchValue(q.raw) },
      ]
    : [];

  const clients = await prisma.client.findMany({
    where: buildClientAccessWhere(user, {
      OR: [{ id: { in: ids } }, ...publicIdMatch(q), ...hashMatches],
    }),
    select: {
      id: true,
      publicId: true,
      name: true,
      phone: true,
      archivedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: SEARCH_RESULTS_PER_TYPE,
  });

  return clients.map<SearchResultItem>((client) => ({
    id: client.id,
    title: client.name,
    meta: compact([
      `#${client.publicId}`,
      canSeeContact ? decryptText(client.phone) : null,
    ]),
    href: `/dashboard/clients/${client.publicId}`,
    badge: client.archivedAt ? "ARCHIVED" : undefined,
  }));
}

async function searchCases(user: AccessControlUser, q: PreparedQuery) {
  const ids = await candidateIds(Prisma.sql`
    SELECT k."id" FROM "Case" k
    JOIN "Client" c ON c."id" = k."clientId" AND c."tenantId" = k."tenantId"
    WHERE k."tenantId" = ${user.tenantId}
      AND ${containsNormalized(
        searchableFields(
          Prisma.sql`k."title"`,
          Prisma.sql`k."caseNumber"`,
          Prisma.sql`k."court"`,
          Prisma.sql`k."judgeName"`,
          Prisma.sql`k."plaintiffName"`,
          Prisma.sql`k."defendantName"`,
          Prisma.sql`k."description"`,
          Prisma.sql`c."name"`,
        ),
        q.needle,
      )}
    ORDER BY k."updatedAt" DESC
    LIMIT ${CANDIDATE_LIMIT}
  `);

  const cases = await prisma.case.findMany({
    where: buildCaseAccessWhere(user, {
      OR: [{ id: { in: ids } }, ...publicIdMatch(q)],
    }),
    select: {
      id: true,
      publicId: true,
      title: true,
      caseNumber: true,
      court: true,
      status: true,
      client: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: SEARCH_RESULTS_PER_TYPE,
  });

  return cases.map<SearchResultItem>((item) => ({
    id: item.id,
    title: item.title,
    meta: compact([item.caseNumber, item.client.name, item.court]),
    href: `/dashboard/cases/${item.publicId}`,
    badge: item.status,
  }));
}

async function searchInvoices(user: AccessControlUser, q: PreparedQuery) {
  const ids = await candidateIds(Prisma.sql`
    SELECT i."id" FROM "Invoice" i
    JOIN "Client" c ON c."id" = i."clientId" AND c."tenantId" = i."tenantId"
    LEFT JOIN "Case" k ON k."id" = i."caseId" AND k."tenantId" = i."tenantId"
    WHERE i."tenantId" = ${user.tenantId}
      AND (
        ${containsNormalized(
          searchableFields(
            Prisma.sql`i."invoiceNumber"`,
            Prisma.sql`i."notes"`,
            Prisma.sql`c."name"`,
            Prisma.sql`k."title"`,
            Prisma.sql`k."caseNumber"`,
          ),
          q.needle,
        )}
        OR EXISTS (
          SELECT 1 FROM "InvoiceItem" it
          WHERE it."invoiceId" = i."id"
            AND ${containsNormalized(Prisma.sql`it."description"`, q.needle)}
        )
      )
    ORDER BY i."updatedAt" DESC
    LIMIT ${CANDIDATE_LIMIT}
  `);

  const invoices = await prisma.invoice.findMany({
    where: buildInvoiceAccessWhere(user, {
      OR: [{ id: { in: ids } }, ...publicIdMatch(q)],
    }),
    select: {
      id: true,
      publicId: true,
      invoiceNumber: true,
      status: true,
      total: true,
      client: { select: { name: true } },
      case: { select: { title: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: SEARCH_RESULTS_PER_TYPE,
  });

  return invoices.map<SearchResultItem>((invoice) => ({
    id: invoice.id,
    title: invoice.invoiceNumber,
    meta: compact([
      invoice.client.name,
      invoice.case?.title,
      formatJOD(invoice.total),
    ]),
    href: `/dashboard/finance/invoices/${invoice.publicId}`,
    badge: invoice.status,
  }));
}

async function searchPayments(
  user: AccessControlUser,
  q: PreparedQuery,
  locale: Locale,
) {
  const ids = await candidateIds(Prisma.sql`
    SELECT p."id" FROM "Payment" p
    JOIN "Client" c ON c."id" = p."clientId" AND c."tenantId" = p."tenantId"
    LEFT JOIN "Case" k ON k."id" = p."caseId" AND k."tenantId" = p."tenantId"
    LEFT JOIN "Invoice" i ON i."id" = p."invoiceId" AND i."tenantId" = p."tenantId"
    WHERE p."tenantId" = ${user.tenantId}
      AND ${containsNormalized(
        searchableFields(
          Prisma.sql`p."reference"`,
          Prisma.sql`p."notes"`,
          Prisma.sql`c."name"`,
          Prisma.sql`k."title"`,
          Prisma.sql`i."invoiceNumber"`,
        ),
        q.needle,
      )}
    ORDER BY p."updatedAt" DESC
    LIMIT ${CANDIDATE_LIMIT}
  `);

  if (ids.length === 0) return [];

  const payments = await prisma.payment.findMany({
    where: buildPaymentAccessWhere(user, { id: { in: ids } }),
    select: {
      id: true,
      amount: true,
      status: true,
      paidAt: true,
      createdAt: true,
      reference: true,
      client: { select: { name: true } },
      invoice: { select: { publicId: true, invoiceNumber: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: SEARCH_RESULTS_PER_TYPE,
  });

  return payments.map<SearchResultItem>((payment) => ({
    id: payment.id,
    title: `${formatJOD(payment.amount)} · ${payment.client.name}`,
    meta: compact([
      payment.invoice?.invoiceNumber,
      payment.reference,
      formatDate(payment.paidAt ?? payment.createdAt, locale),
    ]),
    href: payment.invoice
      ? `/dashboard/finance/invoices/${payment.invoice.publicId}`
      : "/dashboard/finance/payments",
    badge: payment.status,
  }));
}

async function searchDocuments(user: AccessControlUser, q: PreparedQuery) {
  const ids = await candidateIds(Prisma.sql`
    SELECT d."id" FROM "Document" d
    LEFT JOIN "Client" c ON c."id" = d."clientId" AND c."tenantId" = d."tenantId"
    LEFT JOIN "Case" k ON k."id" = d."caseId" AND k."tenantId" = d."tenantId"
    WHERE d."tenantId" = ${user.tenantId}
      AND ${containsNormalized(
        searchableFields(
          Prisma.sql`d."fileName"`,
          Prisma.sql`d."notes"`,
          Prisma.sql`array_to_string(d."tags", ' ')`,
          Prisma.sql`c."name"`,
          Prisma.sql`k."title"`,
        ),
        q.needle,
      )}
    ORDER BY d."updatedAt" DESC
    LIMIT ${CANDIDATE_LIMIT}
  `);

  if (ids.length === 0) return [];

  const documents = await prisma.document.findMany({
    where: buildDocumentAccessWhere(user, { id: { in: ids } }),
    select: {
      id: true,
      fileName: true,
      client: { select: { name: true } },
      case: { select: { publicId: true, title: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: SEARCH_RESULTS_PER_TYPE,
  });

  return documents.map<SearchResultItem>((document) => ({
    id: document.id,
    title: document.fileName,
    meta: compact([document.case?.title, document.client?.name]),
    href: document.case
      ? `/dashboard/cases/${document.case.publicId}`
      : "/dashboard/documents",
  }));
}

async function searchAppointments(
  user: AccessControlUser,
  q: PreparedQuery,
  locale: Locale,
) {
  const ids = await candidateIds(Prisma.sql`
    SELECT a."id" FROM "Appointment" a
    LEFT JOIN "Client" c ON c."id" = a."clientId" AND c."tenantId" = a."tenantId"
    LEFT JOIN "Case" k ON k."id" = a."caseId" AND k."tenantId" = a."tenantId"
    WHERE a."tenantId" = ${user.tenantId}
      AND ${containsNormalized(
        searchableFields(
          Prisma.sql`a."title"`,
          Prisma.sql`a."description"`,
          Prisma.sql`a."location"`,
          Prisma.sql`c."name"`,
          Prisma.sql`k."title"`,
        ),
        q.needle,
      )}
    ORDER BY a."startTime" DESC
    LIMIT ${CANDIDATE_LIMIT}
  `);

  if (ids.length === 0) return [];

  const appointments = await prisma.appointment.findMany({
    where: buildAppointmentAccessWhere(user, { id: { in: ids } }),
    select: {
      id: true,
      title: true,
      startTime: true,
      status: true,
      client: { select: { name: true } },
      case: { select: { publicId: true, title: true } },
    },
    orderBy: { startTime: "desc" },
    take: SEARCH_RESULTS_PER_TYPE,
  });

  return appointments.map<SearchResultItem>((appointment) => ({
    id: appointment.id,
    title: appointment.title,
    meta: compact([
      formatDateTime(appointment.startTime, locale),
      appointment.case?.title ?? appointment.client?.name,
    ]),
    href: appointment.case
      ? `/dashboard/cases/${appointment.case.publicId}`
      : "/dashboard/appointments",
    badge: appointment.status,
  }));
}

async function searchTasks(
  user: AccessControlUser,
  q: PreparedQuery,
  locale: Locale,
) {
  const ids = await candidateIds(Prisma.sql`
    SELECT t."id" FROM "Task" t
    LEFT JOIN "Client" c ON c."id" = t."clientId" AND c."tenantId" = t."tenantId"
    LEFT JOIN "Case" k ON k."id" = t."caseId" AND k."tenantId" = t."tenantId"
    WHERE t."tenantId" = ${user.tenantId}
      AND ${containsNormalized(
        searchableFields(
          Prisma.sql`t."title"`,
          Prisma.sql`t."description"`,
          Prisma.sql`c."name"`,
          Prisma.sql`k."title"`,
        ),
        q.needle,
      )}
    ORDER BY t."updatedAt" DESC
    LIMIT ${CANDIDATE_LIMIT}
  `);

  if (ids.length === 0) return [];

  const tasks = await prisma.task.findMany({
    where: buildTaskAccessWhere(user, { id: { in: ids } }),
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      case: { select: { publicId: true, title: true } },
      client: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: SEARCH_RESULTS_PER_TYPE,
  });

  return tasks.map<SearchResultItem>((task) => ({
    id: task.id,
    title: task.title,
    meta: compact([
      task.case?.title ?? task.client?.name,
      task.dueDate ? formatDate(task.dueDate, locale) : null,
    ]),
    href: task.case
      ? `/dashboard/cases/${task.case.publicId}`
      : "/dashboard/tasks",
    badge: task.status,
  }));
}

async function searchTeam(user: AccessControlUser, q: PreparedQuery) {
  const members = await prisma.$queryRaw<
    Array<{ id: string; name: string; email: string; role: string; isActive: boolean }>
  >(Prisma.sql`
    SELECT u."id", u."name", u."email", u."role"::text AS "role", u."isActive"
    FROM "User" u
    WHERE u."tenantId" = ${user.tenantId}
      AND ${containsNormalized(
        searchableFields(Prisma.sql`u."name"`, Prisma.sql`u."email"`),
        q.needle,
      )}
    ORDER BY u."isActive" DESC, u."name" ASC
    LIMIT ${SEARCH_RESULTS_PER_TYPE}
  `);

  return members.map<SearchResultItem>((member) => ({
    id: member.id,
    title: member.name,
    meta: [member.email],
    href: "/dashboard/team",
    badge: member.isActive ? member.role : "INACTIVE",
  }));
}

const none = async () => [] as SearchResultItem[];

/**
 * Every type in parallel, each limited to the user's office and role.
 * Staff see no invoices or payments; only admins see the team.
 */
export async function runGlobalSearch(
  user: AccessControlUser,
  q: PreparedQuery,
  locale: Locale,
): Promise<SearchResults> {
  const canSeeFinance = user.role === "ADMIN" || user.role === "LAWYER";

  const [clients, cases, invoices, payments, documents, appointments, tasks, team] =
    await Promise.all([
      searchClients(user, q),
      searchCases(user, q),
      canSeeFinance ? searchInvoices(user, q) : none(),
      canSeeFinance ? searchPayments(user, q, locale) : none(),
      searchDocuments(user, q),
      searchAppointments(user, q, locale),
      searchTasks(user, q, locale),
      user.role === "ADMIN" ? searchTeam(user, q) : none(),
    ]);

  return { clients, cases, invoices, payments, documents, appointments, tasks, team };
}
