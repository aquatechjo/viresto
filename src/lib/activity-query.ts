import type { Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "@/lib/api-auth";

export function addActivityAndCondition(
  where: Prisma.ActivityWhereInput,
  condition: Prisma.ActivityWhereInput,
) {
  const currentAnd = where.AND;

  if (!currentAnd) {
    where.AND = [condition];
    return;
  }

  where.AND = Array.isArray(currentAnd)
    ? [...currentAnd, condition]
    : [currentAnd, condition];
}

export function buildActivityCategoryCondition(
  category: string,
): Prisma.ActivityWhereInput | null {
  const contains = (value: string): Prisma.StringFilter<"Activity"> => ({
    contains: value,
    mode: "insensitive",
  });

  const fields = (values: string[]): Prisma.ActivityWhereInput => ({
    OR: values.flatMap((value) => [
      { type: contains(value) },
      { title: contains(value) },
      { message: contains(value) },
      { entityType: contains(value) },
    ]),
  });

  switch (category) {
    case "clients":
      return fields(["CLIENT", "موكل"]);
    case "cases":
      return fields(["CASE", "قضية"]);
    case "appointments":
      return fields(["APPOINTMENT", "موعد"]);
    case "tasks":
      return fields(["TASK", "مهمة"]);
    case "documents":
      return fields(["DOCUMENT", "مستند"]);
    case "payments":
      return fields(["PAYMENT", "دفعة"]);
    case "invoices":
      return fields(["INVOICE", "فاتورة"]);
    case "security":
      return fields([
        "LOGIN",
        "LOGOUT",
        "SESSION",
        "PASSWORD",
        "2FA",
        "TWO_FACTOR",
        "AUTH",
        "تسجيل دخول",
        "تسجيل خروج",
        "كلمة المرور",
        "التحقق الثنائي",
      ]);
    default:
      return null;
  }
}

export function buildVisibleActivityWhere(
  user: Pick<AuthenticatedUser, "tenantId" | "userId" | "role">,
  canViewFinance: boolean,
): Prisma.ActivityWhereInput {
  const where: Prisma.ActivityWhereInput = {
    tenantId: user.tenantId,
    ...(user.role !== "ADMIN" ? { actorId: user.userId } : {}),
  };

  if (!canViewFinance) {
    const paymentCondition = buildActivityCategoryCondition("payments");
    const invoiceCondition = buildActivityCategoryCondition("invoices");

    addActivityAndCondition(where, {
      NOT: [paymentCondition, invoiceCondition].filter(
        (condition): condition is Prisma.ActivityWhereInput =>
          condition !== null,
      ),
    });
  }

  return where;
}
