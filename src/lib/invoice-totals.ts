import { roundMoney } from "@/lib/finance";
import { MAX_JOD_AMOUNT } from "@/lib/money";

export type InvoiceItemInput = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type CalculatedInvoiceItem = InvoiceItemInput & { total: number };

export type InvoiceTotals = {
  error: string | null;
  items: CalculatedInvoiceItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
};

export const INVOICE_ZERO_TOTAL_MESSAGE =
  "إجمالي الفاتورة يجب أن يكون أكبر من صفر";

/**
 * The amounts of an invoice, rounded to the fils, as saved on create and
 * on every edit of its items, tax or discount. `error` is set (and the
 * invoice must not be saved) when an amount is above the allowed maximum,
 * the discount exceeds subtotal plus tax, or the total is not above zero.
 */
export function calculateInvoiceTotals(
  itemsInput: InvoiceItemInput[],
  taxInput = 0,
  discountInput = 0,
): InvoiceTotals {
  const items: CalculatedInvoiceItem[] = itemsInput.map((item) => {
    const quantity = roundMoney(Number(item.quantity));
    const unitPrice = roundMoney(Number(item.unitPrice));

    return {
      description: item.description.trim(),
      quantity,
      unitPrice,
      total: roundMoney(quantity * unitPrice),
    };
  });

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.total, 0));
  const tax = roundMoney(Number(taxInput || 0));
  const discount = roundMoney(Number(discountInput || 0));
  const beforeDiscount = roundMoney(subtotal + tax);
  const failed = (error: string): InvoiceTotals => ({
    error,
    items,
    subtotal,
    tax,
    discount,
    total: 0,
  });

  if (
    items.some((item) => item.total > MAX_JOD_AMOUNT) ||
    subtotal > MAX_JOD_AMOUNT ||
    beforeDiscount > MAX_JOD_AMOUNT
  ) {
    return failed("إجمالي الفاتورة أكبر من الحد المالي المسموح");
  }

  if (discount > beforeDiscount) {
    return failed("الخصم لا يمكن أن يكون أكبر من المجموع مع الضريبة");
  }

  const total = roundMoney(beforeDiscount - discount);

  // A zero invoice is nothing to collect, and it could never become paid
  // (calculateInvoiceStatus needs a total above zero), so it would stay
  // "unpaid" forever.
  if (total <= 0) {
    return failed(INVOICE_ZERO_TOTAL_MESSAGE);
  }

  return { error: null, items, subtotal, tax, discount, total };
}
