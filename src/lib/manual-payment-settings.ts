export const MANUAL_PAYMENT_SETTINGS_ID = "default";

export type ManualPaymentMethodCode = "CLIQ" | "BANK_TRANSFER";

export type ManualPaymentSettingsLike = {
  isEnabled: boolean;
  accountHolderName: string | null;
  cliqEnabled: boolean;
  cliqAlias: string | null;
  bankTransferEnabled: boolean;
  bankName: string | null;
  iban: string | null;
  instructionsAr: string | null;
  instructionsEn: string | null;
};

export type PublicManualPaymentMethod = {
  code: ManualPaymentMethodCode;
  labelAr: string;
  labelEn: string;
  fields: Array<{
    key: string;
    labelAr: string;
    labelEn: string;
    value: string;
    direction?: "ltr" | "rtl";
  }>;
};

function clean(value?: string | null) {
  return value?.trim() || "";
}

export function normalizeManualPaymentMethod(
  value: unknown,
): ManualPaymentMethodCode | null {
  const method = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[ -]+/g, "_");

  if (method === "CLIQ") return "CLIQ";
  if (method === "BANK_TRANSFER") return "BANK_TRANSFER";

  return null;
}

export function getConfiguredManualPaymentMethods(
  settings: ManualPaymentSettingsLike | null,
): PublicManualPaymentMethod[] {
  if (!settings) return [];

  const accountHolderName = clean(settings.accountHolderName);
  const methods: PublicManualPaymentMethod[] = [];

  if (settings.cliqEnabled && accountHolderName && clean(settings.cliqAlias)) {
    methods.push({
      code: "CLIQ",
      labelAr: "CliQ",
      labelEn: "CliQ",
      fields: [
        {
          key: "accountHolderName",
          labelAr: "اسم المستفيد",
          labelEn: "Beneficiary name",
          value: accountHolderName,
        },
        {
          key: "cliqAlias",
          labelAr: "معرّف CliQ",
          labelEn: "CliQ alias",
          value: clean(settings.cliqAlias),
          direction: "ltr",
        },
      ],
    });
  }

  if (
    settings.bankTransferEnabled &&
    accountHolderName &&
    clean(settings.bankName) &&
    clean(settings.iban)
  ) {
    methods.push({
      code: "BANK_TRANSFER",
      labelAr: "تحويل بنكي",
      labelEn: "Bank transfer",
      fields: [
        {
          key: "accountHolderName",
          labelAr: "اسم صاحب الحساب",
          labelEn: "Account holder",
          value: accountHolderName,
        },
        {
          key: "bankName",
          labelAr: "اسم البنك",
          labelEn: "Bank name",
          value: clean(settings.bankName),
        },
        {
          key: "iban",
          labelAr: "IBAN",
          labelEn: "IBAN",
          value: clean(settings.iban),
          direction: "ltr",
        },
      ],
    });
  }

  return methods;
}

export function buildPublicManualPaymentSettings(
  settings: ManualPaymentSettingsLike | null,
) {
  const configuredMethods = getConfiguredManualPaymentMethods(settings);
  const enabled = Boolean(settings?.isEnabled && configuredMethods.length > 0);

  return {
    enabled,
    methods: enabled ? configuredMethods : [],
    instructionsAr: enabled ? clean(settings?.instructionsAr) || null : null,
    instructionsEn: enabled ? clean(settings?.instructionsEn) || null : null,
  };
}
