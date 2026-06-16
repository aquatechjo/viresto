import { CreateCheckoutInput, CheckoutResult, PaymentProvider } from "../types";

interface TapChargeResponse {
  id?: string;
  customer?: {
    id?: string;
  };
  transaction?: {
    url?: string;
  };
  status?: string;
  response?: {
    code?: string;
    message?: string;
  };
  errors?: Array<{
    code?: string;
    description?: string;
  }>;
}

function amountFromFils(amountInFils: number) {
  return Number((amountInFils / 1000).toFixed(3));
}

function splitName(name: string) {
  const clean = name.trim();

  if (!clean) {
    return {
      firstName: "Viresto",
      lastName: "Customer",
    };
  }

  const parts = clean.split(/\s+/);

  return {
    firstName: parts[0] || "Viresto",
    lastName: parts.slice(1).join(" ") || "Customer",
  };
}

function normalizePhone(phone?: string | null) {
  if (!phone) return null;

  const digits = phone.replace(/[^\d+]/g, "");

  if (!digits) return null;

  return digits;
}

export class TapBillingProvider implements PaymentProvider {
  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const secretKey = process.env.TAP_SECRET_KEY;

    if (!secretKey) {
      throw new Error("TAP_SECRET_KEY is not configured");
    }

    const amount = amountFromFils(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invalid Tap charge amount");
    }

    if (!input.currency) {
      throw new Error("Invalid Tap charge currency");
    }
    const { firstName, lastName } = splitName(input.customer.name);
    const phone = normalizePhone(input.customer.phone);

    const payload = {
      amount,
      currency: input.currency,
      threeDSecure: true,
      save_card: false,
      description: `Viresto ${input.planName} ${input.interval}`,
      statement_descriptor: "Viresto",
      metadata: {
        tenantId: input.tenantId,
        userId: input.userId,
        planCode: input.planCode,
        interval: input.interval,
      },
      receipt: {
        email: true,
        sms: false,
      },
      customer: {
        first_name: firstName,
        last_name: lastName,
        email: input.customer.email,
        ...(phone
          ? {
              phone: {
                country_code: "962",
                number: phone.replace(/^\+?962/, "").replace(/^0/, ""),
              },
            }
          : {}),
      },
      source: {
        id: "src_all",
      },
      redirect: {
        url: input.successUrl,
      },
      post: {
        url: input.webhookUrl,
      },
    };

    const res = await fetch("https://api.tap.company/v2/charges", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        lang_code: "ar",
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as TapChargeResponse;

    if (!res.ok) {
      const message =
        data.errors?.[0]?.description ||
        data.response?.message ||
        "Tap charge creation failed";

      throw new Error(message);
    }

    const checkoutUrl = data.transaction?.url;

    if (!checkoutUrl) {
      throw new Error("Tap did not return a checkout URL");
    }

    return {
      provider: "TAP",
      checkoutUrl,
      providerReferenceId: data.id ?? null,
      providerCustomerId: data.customer?.id ?? null,
    };
  }
}
