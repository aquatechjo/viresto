import { DateTime } from "luxon";

export const AI_QUOTA_EXCEEDED_CODE = "AI_QUOTA_EXCEEDED";
export const AI_OCR_RESERVE_TOKENS = 30_000;

const AI_USAGE_TIME_ZONE = "Asia/Amman";
const TOKEN_ESTIMATE_OVERHEAD = 256;

export function getAiUsagePeriod(now = new Date()) {
  const local = DateTime.fromJSDate(now, { zone: "utc" }).setZone(
    AI_USAGE_TIME_ZONE,
  );

  return {
    start: local.startOf("month").toUTC().toJSDate(),
    end: local.plus({ months: 1 }).startOf("month").toUTC().toJSDate(),
  };
}

export function estimateAiTokenBudget(
  textParts: Array<string | null | undefined>,
  maxCompletionTokens: number,
) {
  const characterCount = textParts.reduce(
    (total, value) => total + (value?.length ?? 0),
    0,
  );
  const completionBudget = Number.isSafeInteger(maxCompletionTokens)
    ? Math.max(maxCompletionTokens, 0)
    : 0;

  return Math.max(
    1,
    Math.min(
      Number.MAX_SAFE_INTEGER,
      characterCount + completionBudget + TOKEN_ESTIMATE_OVERHEAD,
    ),
  );
}

export function normalizeActualTokenUsage(
  actualTokens: number | null | undefined,
  reservedTokens: number,
) {
  return Number.isSafeInteger(actualTokens) && Number(actualTokens) > 0
    ? Number(actualTokens)
    : reservedTokens;
}
