import { getPlanByCode, type PlanCode } from "@/config/plans";

// = APP_TRIAL_DAYS in tenant-access.ts (pinned by tests/unit/trial-copy.test.ts).
// Not imported from there: this file ships to the browser, that one pulls
// in @prisma/client.
export const TRIAL_DAYS = 14;

// The free trial runs every feature on Pro's limits, whatever plan the
// visitor picked on the website (decision 2026-10-17, AUDIT_REPORT.md M1).
// One wording for the register page, the trial card and the subscribe page,
// built from src/config/plans.ts so the numbers never drift.

const TRIAL_LIMITS_PLAN: PlanCode = "PRO";

export function isPlanCode(value: unknown): value is PlanCode {
  return value === "BASIC" || value === "PRO" || value === "BUSINESS";
}

function limitsText(isArabic: boolean) {
  const plan = getPlanByCode(TRIAL_LIMITS_PLAN)!;
  const { users, clients, cases, storageGb } = plan.limits;
  const number = (value: number) => value.toLocaleString("en-US");

  return isArabic
    ? `${number(users)} مستخدمين، ${number(clients)} موكل، ${number(cases)} قضية، ${storageGb}GB تخزين`
    : `${number(users)} users, ${number(clients)} clients, ${number(cases)} cases, ${storageGb}GB storage`;
}

/**
 * "All features, on Pro limits" in one sentence, plus the chosen plan if
 * any. `during` words it for an office already on its trial.
 */
export function trialLimitsNote(
  isArabic: boolean,
  chosenPlan?: PlanCode | null,
  when: "signup" | "during" = "signup",
) {
  const limits = limitsText(isArabic);
  const chosen = chosenPlan ? getPlanByCode(chosenPlan) : null;

  if (when === "during") {
    const picked =
      chosen && chosen.code !== TRIAL_LIMITS_PLAN
        ? isArabic
          ? ` اخترت خطة ${chosen.name} عند التسجيل، وتجدها محددة لك عند الاشتراك.`
          : ` You picked ${chosen.name} when signing up; it is preselected when you subscribe.`
        : "";

    return isArabic
      ? `كل الميزات مفتوحة في تجربتك، بحدود خطة Pro (${limits}).${picked}`
      : `Every feature is unlocked on your trial, on Pro limits (${limits}).${picked}`;
  }

  if (!chosen) {
    return isArabic
      ? `تجربة مجانية لمدة ${TRIAL_DAYS} يومًا بلا بطاقة: كل الميزات مفتوحة، بحدود خطة Pro (${limits}).`
      : `A ${TRIAL_DAYS}-day free trial, no card needed: every feature is unlocked, on Pro limits (${limits}).`;
  }

  if (chosen.code === TRIAL_LIMITS_PLAN) {
    return isArabic
      ? `اخترت خطة Pro. تبدأ بتجربة مجانية لمدة ${TRIAL_DAYS} يومًا بلا بطاقة، بكل الميزات وبحدود Pro نفسها (${limits}).`
      : `You picked Pro. You start with a ${TRIAL_DAYS}-day free trial, no card needed, with every feature and Pro's own limits (${limits}).`;
  }

  return isArabic
    ? `اخترت خطة ${chosen.name}. تبدأ بتجربة مجانية لمدة ${TRIAL_DAYS} يومًا بلا بطاقة: كل الميزات مفتوحة، لكن بحدود خطة Pro (${limits}). عند الاشتراك تجد خطة ${chosen.name} محددة لك.`
    : `You picked ${chosen.name}. You start with a ${TRIAL_DAYS}-day free trial, no card needed: every feature is unlocked, on Pro limits (${limits}). When you subscribe, ${chosen.name} is preselected for you.`;
}
