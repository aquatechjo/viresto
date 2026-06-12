type SendWhatsappVerificationInput = {
  to: string;
  code: string;
};

function normalizeWhatsappRecipient(phone: string) {
  const cleaned = phone.replace(/[\s\-()]/g, "").trim();

  if (cleaned.startsWith("+")) return cleaned.slice(1);
  if (cleaned.startsWith("00")) return cleaned.slice(2);
  if (cleaned.startsWith("07")) return `962${cleaned.slice(1)}`;
  if (cleaned.startsWith("7") && cleaned.length === 9) return `962${cleaned}`;

  return cleaned;
}

export async function sendWhatsappVerificationCode({ to, code }: SendWhatsappVerificationInput) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_VERIFY_TEMPLATE_NAME || "viresto_verify_code";
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANG || "ar";
  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v20.0";

  if (!accessToken || !phoneNumberId) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV WHATSAPP VERIFICATION] to=${to} code=${code}`);
      return { skipped: true };
    }

    throw new Error("Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID");
  }

  const recipient = normalizeWhatsappRecipient(to);

  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: languageCode,
          },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: code,
                },
              ],
            },
          ],
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Failed to send WhatsApp verification: ${response.status} ${errorText}`);
  }

  return response.json().catch(() => ({ ok: true }));
}
