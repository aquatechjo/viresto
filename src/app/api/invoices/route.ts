import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireRole, getRequestMeta } from '@/lib/api-auth'
import { ok, err } from '@/lib/api-response'
import { apiHandler } from '@/lib/api-handler'
import { logActivity } from '@/lib/activity'
import { invoiceCreateSchema } from '@/lib/validations'

const allowedStatuses = ['DRAFT', 'UNPAID', 'PAID', 'OVERDUE', 'CANCELLED'] as const

type CalculatedItem = {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function calculateTotals(
  itemsInput: Array<{ description: string; quantity: number; unitPrice: number }>,
  taxInput = 0,
  discountInput = 0
) {
  const items: CalculatedItem[] = itemsInput.map((item) => {
    const quantity = roundMoney(Number(item.quantity))
    const unitPrice = roundMoney(Number(item.unitPrice))

    return {
      description: item.description.trim(),
      quantity,
      unitPrice,
      total: roundMoney(quantity * unitPrice),
    }
  })

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.total, 0))
  const tax = roundMoney(Number(taxInput || 0))
  const discount = roundMoney(Number(discountInput || 0))
  const beforeDiscount = roundMoney(subtotal + tax)

  if (discount > beforeDiscount) {
    return {
      error: 'الخصم لا يمكن أن يكون أكبر من المجموع مع الضريبة',
      items,
      subtotal,
      tax,
      discount,
      total: 0,
    }
  }

  return {
    error: null,
    items,
    subtotal,
    tax,
    discount,
    total: roundMoney(beforeDiscount - discount),
  }
}

async function generateInvoiceNumber(
  tenantId: string,
  tx: Prisma.TransactionClient = prisma
) {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`

  const lastInvoice = await tx.invoice.findFirst({
    where: {
      tenantId,
      invoiceNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      invoiceNumber: 'desc',
    },
    select: {
      invoiceNumber: true,
    },
  })

  const lastPart = lastInvoice?.invoiceNumber?.replace(prefix, '')
  const parsed = lastPart ? Number(lastPart) : 0
  const nextNumber = Number.isNaN(parsed) ? 1 : parsed + 1

  return `${prefix}${String(nextNumber).padStart(4, '0')}`
}

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER', 'STAFF'])
    if (auth.error || !auth.user) return auth.error

    const sp = new URL(req.url).searchParams
    const status = sp.get('status') || ''
    const q = sp.get('q') || ''

    const limitRaw = Number(sp.get('limit') || 50)
    const limit = Number.isNaN(limitRaw)
      ? 50
      : Math.min(Math.max(limitRaw, 1), 100)

    if (status && !allowedStatuses.includes(status as any)) {
      return err('حالة الفاتورة غير صالحة', 400)
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId: auth.user.tenantId,
        ...(status ? { status: status as any } : {}),
        ...(q
          ? {
              OR: [
                { invoiceNumber: { contains: q, mode: 'insensitive' } },
                { client: { name: { contains: q, mode: 'insensitive' } } },
                { case: { title: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            archivedAt: true,
          },
        },
        case: {
          select: {
            id: true,
            title: true,
            caseNumber: true,
            client: {
              select: {
                id: true,
                name: true,
                archivedAt: true,
              },
            },
          },
        },
        items: true,
        payment: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    })

    return ok(invoices)
  })
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER'])
    if (auth.error || !auth.user) return auth.error

    const meta = getRequestMeta(req)
    const body = await req.json().catch(() => ({}))
    const parsed = invoiceCreateSchema.safeParse(body)

    if (!parsed.success) {
      return err('بيانات الفاتورة غير صالحة', 400, parsed.error.flatten())
    }

    const data = parsed.data
    const caseId = data.caseId || null
    const dueDate = data.dueDate ? new Date(data.dueDate) : null
    const notes = data.notes?.trim() || null
    const totals = calculateTotals(data.items, data.tax, data.discount)

    if (totals.error) {
      return err(totals.error, 400)
    }

    const client = await prisma.client.findFirst({
      where: {
        id: data.clientId,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        name: true,
        archivedAt: true,
      },
    })

    if (!client) {
      return err('الموكل غير موجود داخل هذا المكتب', 404)
    }

    if (client.archivedAt) {
      return err('لا يمكن إنشاء فاتورة لموكل مؤرشف', 400)
    }

    if (caseId) {
      const selectedCase = await prisma.case.findFirst({
        where: {
          id: caseId,
          tenantId: auth.user.tenantId,
          clientId: data.clientId,
        },
        select: {
          id: true,
          client: {
            select: {
              id: true,
              archivedAt: true,
            },
          },
        },
      })

      if (!selectedCase) {
        return err('القضية غير موجودة لهذا الموكل', 404)
      }

      if (selectedCase.client?.archivedAt) {
        return err('لا يمكن إنشاء فاتورة لقضية موكلها مؤرشف', 400)
      }
    }

    let invoice: Awaited<ReturnType<typeof prisma.invoice.create>> | null = null

    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        invoice = await prisma.$transaction(async (tx) => {
          const invoiceNumber = await generateInvoiceNumber(auth.user!.tenantId, tx)

          return tx.invoice.create({
            data: {
              tenantId: auth.user!.tenantId,
              clientId: data.clientId,
              caseId,
              invoiceNumber,
              status: 'UNPAID',
              dueDate,
              subtotal: totals.subtotal,
              tax: totals.tax,
              discount: totals.discount,
              total: totals.total,
              notes,
              items: {
                create: totals.items,
              },
            },
            include: {
              client: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  email: true,
                  archivedAt: true,
                },
              },
              case: {
                select: {
                  id: true,
                  title: true,
                  caseNumber: true,
                  client: {
                    select: {
                      id: true,
                      name: true,
                      archivedAt: true,
                    },
                  },
                },
              },
              items: true,
              payment: true,
            },
          })
        })
        break
      } catch (error: any) {
        if (error?.code !== 'P2002' || attempt === 5) {
          throw error
        }
      }
    }

    if (!invoice) {
      return err('تعذر إنشاء رقم فاتورة فريد، حاول مرة أخرى', 409)
    }

    await logActivity({
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: auth.user.tenantId,
      type: 'INVOICE_CREATED',
      title: 'تم إنشاء فاتورة جديدة',
      message: `${invoice.invoiceNumber} - ${client.name}`,
      entityType: caseId ? 'CASE' : 'INVOICE',
      entityId: caseId || invoice.id,
    })

    return ok(invoice, 201)
  })
}