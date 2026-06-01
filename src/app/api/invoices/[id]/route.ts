import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, getRequestMeta } from '@/lib/api-auth'
import { ok, err } from '@/lib/api-response'
import { apiHandler } from '@/lib/api-handler'
import { logActivity } from '@/lib/activity'
import { invoiceUpdateSchema } from '@/lib/validations'

type Params = { params: Promise<{ id: string }> }

type InvoiceStatus = 'DRAFT' | 'UNPAID' | 'PAID' | 'OVERDUE' | 'CANCELLED'

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function hasFinancialChanges(data: Record<string, unknown>) {
  return ['clientId', 'caseId', 'tax', 'discount', 'items'].some((key) => key in data)
}

function calculateTotals(
  itemsInput: Array<{ description: string; quantity: number; unitPrice: number }>,
  taxInput = 0,
  discountInput = 0
) {
  const items = itemsInput.map((item) => {
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

export async function GET(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER', 'STAFF'])
    if (auth.error || !auth.user) return auth.error

    const { id } = await params

    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            logoUrl: true,
          },
        },
        client: true,
        case: true,
        items: true,
        payment: true,
      },
    })

    if (!invoice) return err('الفاتورة غير موجودة', 404)

    return ok(invoice)
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER'])
    if (auth.error || !auth.user) return auth.error

    const meta = getRequestMeta(req)
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const parsed = invoiceUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return err('بيانات الفاتورة غير صالحة', 400, parsed.error.flatten())
    }

    if (Object.keys(parsed.data).length === 0) {
      return err('لا توجد بيانات للتعديل', 400)
    }

    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      include: {
        items: true,
        payment: true,
      },
    })

    if (!invoice) return err('الفاتورة غير موجودة', 404)

    const financialChanges = hasFinancialChanges(parsed.data)

    if (financialChanges && invoice.status === 'PAID') {
      return err('لا يمكن تعديل بيانات مالية لفاتورة مدفوعة. غيّر الحالة أولًا ثم عدّلها.', 409)
    }

    if (financialChanges && invoice.payment?.status === 'PAID') {
      return err('لا يمكن تعديل فاتورة مرتبطة بدفعة مدفوعة', 409)
    }

    const nextClientId = parsed.data.clientId ?? invoice.clientId
    const nextCaseId =
      parsed.data.caseId !== undefined ? parsed.data.caseId || null : invoice.caseId
    const nextStatus = (parsed.data.status ?? invoice.status) as InvoiceStatus

    const client = await prisma.client.findFirst({
      where: {
        id: nextClientId,
        tenantId: auth.user.tenantId,
      },
      select: { id: true, name: true },
    })

    if (!client) return err('الموكل غير موجود داخل هذا المكتب', 404)

    if (nextCaseId) {
      const selectedCase = await prisma.case.findFirst({
        where: {
          id: nextCaseId,
          tenantId: auth.user.tenantId,
          clientId: nextClientId,
        },
        select: { id: true },
      })

      if (!selectedCase) return err('القضية غير موجودة لهذا الموكل', 404)
    }

    if (nextStatus === 'PAID' && !nextCaseId) {
      return err('لا يمكن تعليم الفاتورة كمدفوعة قبل ربطها بقضية، لأن الدفعات مرتبطة بالقضايا', 400)
    }

    const itemsForTotals = parsed.data.items ?? invoice.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }))

    const taxForTotals = parsed.data.tax ?? invoice.tax
    const discountForTotals = parsed.data.discount ?? invoice.discount
    const totals = calculateTotals(itemsForTotals, taxForTotals, discountForTotals)

    if (totals.error) {
      return err(totals.error, 400)
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.items) {
        await tx.invoiceItem.deleteMany({
          where: { invoiceId: invoice.id },
        })
      }

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          ...(parsed.data.clientId !== undefined ? { clientId: nextClientId } : {}),
          ...(parsed.data.caseId !== undefined ? { caseId: nextCaseId } : {}),
          ...(parsed.data.status !== undefined ? { status: nextStatus } : {}),
          ...(parsed.data.dueDate !== undefined
            ? { dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null }
            : {}),
          ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes?.trim() || null } : {}),
          ...(financialChanges
            ? {
                subtotal: totals.subtotal,
                tax: totals.tax,
                discount: totals.discount,
                total: totals.total,
              }
            : {}),
          ...(parsed.data.items
            ? {
                items: {
                  create: totals.items,
                },
              }
            : {}),
        },
        include: {
          client: true,
          case: true,
          items: true,
          payment: true,
        },
      })

      if (nextStatus === 'PAID' && nextCaseId) {
        if (updatedInvoice.payment) {
          await tx.payment.update({
            where: { invoiceId: updatedInvoice.id },
            data: {
              caseId: nextCaseId,
              amount: updatedInvoice.total,
              status: 'PAID',
              paidAt: new Date(),
              notes: `دفعة من الفاتورة ${updatedInvoice.invoiceNumber}`,
            },
          })
        } else {
          await tx.payment.create({
            data: {
              tenantId: auth.user!.tenantId,
              caseId: nextCaseId,
              invoiceId: updatedInvoice.id,
              amount: updatedInvoice.total,
              status: 'PAID',
              method: 'CASH',
              paidAt: new Date(),
              notes: `دفعة تلقائية من الفاتورة ${updatedInvoice.invoiceNumber}`,
            },
          })
        }
      }

      if (nextStatus !== 'PAID' && updatedInvoice.payment) {
        await tx.payment.update({
          where: { invoiceId: updatedInvoice.id },
          data: {
            status: nextStatus === 'CANCELLED' ? 'CANCELLED' : 'PENDING',
            notes: `دفعة مرتبطة بالفاتورة ${updatedInvoice.invoiceNumber}`,
          },
        })
      }

      return tx.invoice.findUnique({
        where: { id: invoice.id },
        include: {
          client: true,
          case: true,
          items: true,
          payment: true,
        },
      })
    })

    const updateActivityCaseId = updated?.caseId ?? invoice.caseId

    await logActivity({
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: auth.user.tenantId,
      type: 'INVOICE_UPDATED',
      title: updateActivityCaseId ? 'تم تعديل فاتورة مرتبطة بالقضية' : 'تم تعديل فاتورة',
      message: invoice.invoiceNumber,
      entityType: updateActivityCaseId ? 'CASE' : 'INVOICE',
      entityId: updateActivityCaseId || invoice.id,
    })

    return ok(updated)
  })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN'])
    if (auth.error || !auth.user) return auth.error

    const meta = getRequestMeta(req)
    const { id } = await params

    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      include: {
        payment: true,
      },
    })

    if (!invoice) return err('الفاتورة غير موجودة', 404)

    if (invoice.payment) {
      return err('لا يمكن حذف فاتورة مرتبطة بدفعة. غيّر حالة الفاتورة أو احذف الدفعة أولًا.', 409)
    }

    await prisma.invoice.delete({
      where: { id: invoice.id },
    })

    const deleteActivityCaseId = invoice.caseId

    await logActivity({
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: auth.user.tenantId,
      type: 'INVOICE_DELETED',
      title: deleteActivityCaseId ? 'تم حذف فاتورة مرتبطة بالقضية' : 'تم حذف فاتورة',
      message: invoice.invoiceNumber,
      entityType: deleteActivityCaseId ? 'CASE' : 'INVOICE',
      entityId: deleteActivityCaseId || invoice.id,
    })

    return ok({ deleted: true })
  })
}
