export function hasPlanCapacity(
  used: number,
  limit: number | null,
  requested = 1,
) {
  if (
    !Number.isSafeInteger(used) ||
    used < 0 ||
    !Number.isSafeInteger(requested) ||
    requested <= 0
  ) {
    return false;
  }

  if (limit === null) return true;

  if (!Number.isSafeInteger(limit) || limit < 0) {
    return false;
  }

  return used <= limit - requested;
}
