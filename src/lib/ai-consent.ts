export const AI_DATA_POLICY_VERSION = "2026-07-17";

export const AI_CONSENT_REQUIRED_CODE = "AI_CONSENT_REQUIRED";

export type AiConsentState = {
  aiEnabled: boolean;
  aiConsentAt?: Date | string | null;
  aiConsentBy?: string | null;
  aiConsentPolicyVersion?: string | null;
};

export function hasCurrentAiConsent(state: AiConsentState) {
  return Boolean(
    state.aiEnabled &&
      state.aiConsentAt &&
      state.aiConsentBy &&
      state.aiConsentPolicyVersion === AI_DATA_POLICY_VERSION,
  );
}
