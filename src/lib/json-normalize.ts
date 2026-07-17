import { Prisma } from "@prisma/client";

export function normalizeJsonValue<T>(value: T): T {
  if (Prisma.Decimal.isDecimal(value)) {
    return value.toNumber() as T;
  }

  if (value instanceof Date || value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonValue(item)) as T;
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        normalizeJsonValue(item),
      ]),
    ) as T;
  }

  return value;
}
