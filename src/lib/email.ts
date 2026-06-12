type SendVerificationEmailInput = {
  to: string;
  code: string;
};

function getAppName() {
  return process.env.APP_NAME || "Viresto";
}

function getEmailFrom() {
  return process.env.EMAIL_FROM || "Viresto <onboarding@resend.dev>";
}

function verificationEmailHtml(code: string) {
  const appName = getAppName();

  return `
  <div dir="rtl" style="font-family: Arial, sans-serif; background:#f4f7f3; padding:32px; color:#173827;">
    <div style="max-width:560px; margin:0 auto; background:#ffffff; border:1px solid #dfe8dc; border-radius:20px; padding:28px;">
      <h1 style="margin:0 0 12px; font-size:22px; color:#1e3329;">تأكيد البريد الإلكتروني</h1>
      <p style="margin:0 0 20px; font-size:15px; line-height:1.8; color:#537065;">
        استخدم الرمز التالي لتأكيد بريدك الإلكتروني في ${appName}.
      </p>
      <div dir="ltr" style="letter-spacing:8px; text-align:center; font-size:32px; font-weight:900; color:#1e3329; background:#eef6f0; border-radius:16px; padding:18px 12px;">
        ${code}
      </div>
      <p style="margin:22px 0 0; font-size:13px; line-height:1.8; color:#8ba498;">
        تنتهي صلاحية الرمز خلال 10 دقائق. لا تشارك هذا الرمز مع أي شخص.
      </p>
    </div>
  </div>`;
}

function verificationEmailText(code: string) {
  return `رمز تأكيد البريد الإلكتروني الخاص بك في ${getAppName()} هو: ${code}\nتنتهي صلاحية الرمز خلال 10 دقائق.`;
}

export async function sendVerificationEmail({ to, code }: SendVerificationEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV EMAIL VERIFICATION] to=${to} code=${code}`);
      return { skipped: true };
    }

    throw new Error("Missing RESEND_API_KEY");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getEmailFrom(),
      to,
      subject: `رمز تأكيد البريد الإلكتروني - ${getAppName()}`,
      html: verificationEmailHtml(code),
      text: verificationEmailText(code),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Failed to send verification email: ${response.status} ${errorText}`);
  }

  return response.json().catch(() => ({ ok: true }));
}
