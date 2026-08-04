import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function isBearerSecretAuthorized(
  authorizationHeader: string | null,
  configuredSecret: string | undefined,
) {
  const expected = configuredSecret?.trim();
  const authorization = authorizationHeader?.match(/^Bearer\s+(.+)$/i);

  if (!expected || !authorization) return false;

  const provided = authorization[1].trim();
  if (!provided) return false;

  return timingSafeEqual(digest(provided), digest(expected));
}
