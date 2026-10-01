import { prisma } from "@/lib/prisma";
import { decryptText } from "@/lib/encryption";

// Full export of one office's data for its ADMIN (AUDIT_REPORT.md M4,
// GET /api/data-requests/export). Streamed as one JSON document, section by
// section, reading each table in id-ordered pages so a large office never
// sits in memory at once.
//
// Left out on purpose: password hashes, 2FA secrets, the blind-index hashes
// of encrypted client fields, sessions, verification/reset codes, invitation
// tokens and notifications. Encrypted client fields are decrypted. Document
// files stay in private storage; the export lists their metadata (see
// docs/data-requests.md for getting the files themselves).

export const OFFICE_EXPORT_FORMAT = "viresto-office-export";
export const OFFICE_EXPORT_VERSION = 1;

const PAGE_SIZE = 500;

type Row = { id: string };
type PageReader<T extends Row> = (args: {
  take: number;
  skip?: number;
  cursor?: { id: string };
}) => Promise<T[]>;

async function* readAll<T extends Row>(readPage: PageReader<T>) {
  let cursor: string | undefined;

  while (true) {
    const page = await readPage({
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    for (const row of page) yield row;
    if (page.length < PAGE_SIZE) return;
    cursor = page[page.length - 1].id;
  }
}

function sections(tenantId: string) {
  const where = { tenantId };
  const orderBy = { id: "asc" as const };

  return {
    users: readAll((page) =>
      prisma.user.findMany({
        where,
        orderBy,
        ...page,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          emailVerifiedAt: true,
          phoneVerifiedAt: true,
          twoFactorEnabled: true,
          termsAcceptedAt: true,
          termsVersion: true,
          privacyAcceptedAt: true,
          privacyVersion: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ),
    clients: (async function* () {
      for await (const client of readAll((page) =>
        prisma.client.findMany({ where, orderBy, ...page }),
      )) {
        const {
          emailHash: _emailHash,
          phoneHash: _phoneHash,
          nationalIdHash: _nationalIdHash,
          ...rest
        } = client;

        yield {
          ...rest,
          email: decryptText(client.email),
          phone: decryptText(client.phone),
          nationalId: decryptText(client.nationalId),
          address: decryptText(client.address),
          notes: decryptText(client.notes),
        };
      }
    })(),
    cases: readAll((page) => prisma.case.findMany({ where, orderBy, ...page })),
    caseMembers: readAll((page) =>
      prisma.caseMember.findMany({ where, orderBy, ...page }),
    ),
    appointments: readAll((page) =>
      prisma.appointment.findMany({ where, orderBy, ...page }),
    ),
    tasks: readAll((page) => prisma.task.findMany({ where, orderBy, ...page })),
    documents: readAll((page) =>
      prisma.document.findMany({
        where,
        orderBy,
        ...page,
        select: {
          id: true,
          clientId: true,
          caseId: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          notes: true,
          tags: true,
          aiSummary: true,
          aiKeyPoints: true,
          aiParties: true,
          aiDates: true,
          aiAmounts: true,
          aiAnalyzedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ),
    invoices: readAll((page) =>
      prisma.invoice.findMany({
        where,
        orderBy,
        ...page,
        include: { items: { orderBy: { createdAt: "asc" } } },
      }),
    ),
    payments: readAll((page) =>
      prisma.payment.findMany({ where, orderBy, ...page }),
    ),
    subscriptions: readAll((page) =>
      prisma.subscription.findMany({
        where,
        orderBy,
        ...page,
        include: { plan: { select: { code: true, name: true } } },
      }),
    ),
    activities: readAll((page) =>
      prisma.activity.findMany({ where, orderBy, ...page }),
    ),
  };
}

/**
 * Yields the export as JSON text chunks. Throws (mid-stream) if a read
 * fails; the caller must abort the response so a truncated file is never
 * mistaken for a complete one.
 */
export async function* streamOfficeDataExport(
  tenantId: string,
  exportedAt = new Date(),
) {
  const office = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      phone: true,
      address: true,
      logoUrl: true,
      plan: true,
      status: true,
      aiEnabled: true,
      aiConsentAt: true,
      aiConsentPolicyVersion: true,
      createdAt: true,
    },
  });

  yield `{"format":${JSON.stringify(OFFICE_EXPORT_FORMAT)},"version":${OFFICE_EXPORT_VERSION},"exportedAt":${JSON.stringify(exportedAt.toISOString())},"office":${JSON.stringify(office)}`;

  for (const [name, rows] of Object.entries(sections(tenantId))) {
    yield `,${JSON.stringify(name)}:[`;
    let first = true;
    for await (const row of rows) {
      yield `${first ? "" : ","}${JSON.stringify(row)}`;
      first = false;
    }
    yield "]";
  }

  yield "}";
}
