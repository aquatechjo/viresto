import { externalFetch } from "@/lib/external-fetch";

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
  <div dir="rtl" style="font-family: Arial, sans-serif; background:#f3f7f6; padding:32px; color:#123f40;">
    <div style="max-width:560px; margin:0 auto; background:#ffffff; border:1px solid #dbe8e5; border-radius:20px; padding:28px;">
      <h1 style="margin:0 0 12px; font-size:22px; color:#082c2d;">تأكيد البريد الإلكتروني</h1>
      <p style="margin:0 0 20px; font-size:15px; line-height:1.8; color:#617e7c;">
        استخدم الرمز التالي لتأكيد بريدك الإلكتروني في ${appName}.
      </p>
      <div dir="ltr" style="letter-spacing:8px; text-align:center; font-size:32px; font-weight:900; color:#082c2d; background:#f7e9dc; border:1px solid #dfb184; border-radius:16px; padding:18px 12px;">
        ${code}
      </div>
      <p style="margin:22px 0 0; font-size:13px; line-height:1.8; color:#789c99;">
        تنتهي صلاحية الرمز خلال 10 دقائق. لا تشارك هذا الرمز مع أي شخص.
      </p>
    </div>
  </div>`;
}

function verificationEmailText(code: string) {
  return `رمز تأكيد البريد الإلكتروني الخاص بك في ${getAppName()} هو: ${code}\nتنتهي صلاحية الرمز خلال 10 دقائق.`;
}

export async function sendVerificationEmail({
  to,
  code,
}: SendVerificationEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV EMAIL VERIFICATION] to=${to} code=${code}`);
      return { skipped: true };
    }

    throw new Error("Missing RESEND_API_KEY");
  }

  const response = await externalFetch("https://api.resend.com/emails", {
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
    throw new Error(
      `Failed to send verification email: ${response.status} ${errorText}`,
    );
  }

  return response.json().catch(() => ({ ok: true }));
}

type SendPasswordResetEmailInput = {
  to: string;
  code: string;
};

export async function sendPasswordResetEmail({
  to,
  code,
}: SendPasswordResetEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV] Password reset code for ${to}: ${code}`);
      return;
    }

    throw new Error("Missing RESEND_API_KEY");
  }

  const response = await externalFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getEmailFrom(),
      to,
      subject: "رمز إعادة تعيين كلمة المرور - Viresto",
      text: `رمز إعادة تعيين كلمة المرور هو: ${code}. الرمز صالح لمدة 10 دقائق.`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.8;">
          <h2>إعادة تعيين كلمة المرور</h2>
          <p>رمز إعادة تعيين كلمة المرور الخاص بك هو:</p>
          <div style="font-size: 28px; font-weight: bold; letter-spacing: 6px; margin: 20px 0;">
            ${code}
          </div>
          <p>الرمز صالح لمدة 10 دقائق.</p>
          <p>إذا لم تطلب تغيير كلمة المرور، تجاهل هذه الرسالة.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send password reset email: ${errorText}`);
  }
}

type SendEmailChangeCodeInput = {
  to: string;
  code: string;
  stage: "OLD" | "NEW";
};

export async function sendEmailChangeCode({
  to,
  code,
  stage,
}: SendEmailChangeCodeInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const isOldEmail = stage === "OLD";
  const title = isOldEmail
    ? "تأكيد طلب تغيير البريد الإلكتروني"
    : "تأكيد البريد الإلكتروني الجديد";
  const description = isOldEmail
    ? "وصلنا طلب لتغيير البريد الإلكتروني المرتبط بحسابك. استخدم الرمز التالي للمتابعة."
    : "استخدم الرمز التالي لتأكيد أن هذا البريد الإلكتروني الجديد يعود إليك.";

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV EMAIL CHANGE ${stage}] to=${to} code=${code}`);
      return { skipped: true };
    }

    throw new Error("Missing RESEND_API_KEY");
  }

  const response = await externalFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getEmailFrom(),
      to,
      subject: `${title} - ${getAppName()}`,
      text: `${description}\nرمز التحقق: ${code}\nتنتهي صلاحية الرمز خلال 10 دقائق.`,
      html: `
        <div dir="rtl" style="font-family:Arial,sans-serif;background:#f3f7f6;padding:32px;color:#123f40;">
          <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #dbe8e5;border-radius:20px;padding:28px;">
            <h1 style="margin:0 0 12px;font-size:22px;color:#082c2d;">${title}</h1>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:#617e7c;">${description}</p>
            <div dir="ltr" style="letter-spacing:8px;text-align:center;font-size:32px;font-weight:900;color:#082c2d;background:#f7e9dc;border:1px solid #dfb184;border-radius:16px;padding:18px 12px;">${code}</div>
            <p style="margin:22px 0 0;font-size:13px;line-height:1.8;color:#789c99;">تنتهي صلاحية الرمز خلال 10 دقائق. لا تشارك هذا الرمز مع أي شخص.</p>
          </div>
        </div>`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Failed to send email change code: ${response.status} ${errorText}`,
    );
  }

  return response.json().catch(() => ({ ok: true }));
}

type SendEmailChangeCompletedInput = {
  to: string;
  accountEmail: string;
  isOldEmail: boolean;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendEmailChangeCompletedEmail({
  to,
  accountEmail,
  isOldEmail,
}: SendEmailChangeCompletedInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const safeAccountEmail = escapeHtml(accountEmail);
  const message = isOldEmail
    ? `تم تغيير البريد الإلكتروني لحسابك إلى ${accountEmail}. إذا لم تنفذ هذه العملية، تواصل مع الدعم فورًا.`
    : `تم اعتماد ${accountEmail} كبريد الدخول الجديد لحسابك.`;

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV EMAIL CHANGE COMPLETED] to=${to} ${message}`);
      return { skipped: true };
    }

    throw new Error("Missing RESEND_API_KEY");
  }

  const response = await externalFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getEmailFrom(),
      to,
      subject: `تم تغيير البريد الإلكتروني - ${getAppName()}`,
      text: message,
      html: `
        <div dir="rtl" style="font-family:Arial,sans-serif;background:#f3f7f6;padding:32px;color:#123f40;">
          <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #dbe8e5;border-radius:20px;padding:28px;">
            <h1 style="margin:0 0 12px;font-size:22px;color:#082c2d;">تم تغيير البريد الإلكتروني</h1>
            <p style="margin:0;font-size:15px;line-height:1.8;color:#617e7c;">${
              isOldEmail
                ? `تم تغيير البريد الإلكتروني لحسابك إلى <b dir="ltr">${safeAccountEmail}</b>. إذا لم تنفذ هذه العملية، تواصل مع الدعم فورًا.`
                : `تم اعتماد <b dir="ltr">${safeAccountEmail}</b> كبريد الدخول الجديد لحسابك.`
            }</p>
          </div>
        </div>`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Failed to send email change completion notice: ${response.status} ${errorText}`,
    );
  }

  return response.json().catch(() => ({ ok: true }));
}

type SendTeamInvitationEmailInput = {
  to: string;
  inviteeName: string;
  tenantName: string;
  inviterName: string;
  token: string;
};

function getAppUrl() {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://www.virestojo.com"
  ).replace(/\/$/, "");
}

export async function sendTeamInvitationEmail({
  to,
  inviteeName,
  tenantName,
  inviterName,
  token,
}: SendTeamInvitationEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const invitationUrl = `${getAppUrl()}/join-team?token=${encodeURIComponent(token)}`;
  const safeInviteeName = escapeHtml(inviteeName);
  const safeTenantName = escapeHtml(tenantName);
  const safeInviterName = escapeHtml(inviterName);
  const safeInvitationUrl = escapeHtml(invitationUrl);

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV TEAM INVITATION] to=${to} url=${invitationUrl}`);
      return { skipped: true };
    }

    throw new Error("Missing RESEND_API_KEY");
  }

  const response = await externalFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getEmailFrom(),
      to,
      subject: `دعوة للانضمام إلى ${tenantName} - ${getAppName()}`,
      text: `${inviterName} دعاك للانضمام إلى ${tenantName} في ${getAppName()}. افتح الرابط التالي واختر كلمة مرورك خلال 72 ساعة: ${invitationUrl}`,
      html: `
        <div dir="rtl" style="font-family:Arial,sans-serif;background:#f3f7f6;padding:32px;color:#123f40;">
          <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #dbe8e5;border-radius:20px;padding:28px;">
            <h1 style="margin:0 0 12px;font-size:22px;color:#082c2d;">دعوة للانضمام إلى فريق المكتب</h1>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.8;color:#617e7c;">مرحبًا ${safeInviteeName}، دعاك ${safeInviterName} للانضمام إلى <b>${safeTenantName}</b> في ${getAppName()}.</p>
            <p style="margin:0 0 22px;font-size:14px;line-height:1.8;color:#617e7c;">اضغط الزر التالي واختر كلمة مرورك بنفسك. تنتهي صلاحية الدعوة خلال 72 ساعة.</p>
            <a href="${safeInvitationUrl}" style="display:inline-block;background:#b87333;color:#071f20;text-decoration:none;font-weight:800;border-radius:14px;padding:13px 22px;">قبول الدعوة</a>
            <p style="margin:22px 0 0;font-size:12px;line-height:1.8;color:#789c99;">إذا لم تكن تتوقع هذه الدعوة، تجاهل الرسالة.</p>
          </div>
        </div>`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Failed to send team invitation: ${response.status} ${errorText}`,
    );
  }

  return response.json().catch(() => ({ ok: true }));
}
