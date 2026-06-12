import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;

function getAppUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendVerificationEmail({
  to,
  code,
}: {
  to: string;
  code: string;
}) {
  if (!resendApiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not configured");
    }

    console.log("EMAIL VERIFICATION CODE:", code);
    console.log("EMAIL VERIFICATION TO:", to);
    return;
  }

  if (!emailFrom) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("EMAIL_FROM is not configured");
    }

    console.log("EMAIL_FROM is not configured");
    console.log("EMAIL VERIFICATION CODE:", code);
    console.log("EMAIL VERIFICATION TO:", to);
    return;
  }

  const safeCode = escapeHtml(code);
  const appUrl = getAppUrl();
  const verifyUrl = `${appUrl}/verify-email?email=${encodeURIComponent(to)}`;

  const resend = new Resend(resendApiKey);

  const { error } = await resend.emails.send({
    from: emailFrom,
    to,
    subject: "رمز تأكيد البريد الإلكتروني - Viresto",
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;background:#071811;padding:28px;color:#ffffff">
        <div style="max-width:560px;margin:0 auto;background:#0b2a1d;border:1px solid rgba(52,211,153,.35);border-radius:22px;padding:28px">
          <h1 style="margin:0 0 12px;font-size:24px">تأكيد البريد الإلكتروني</h1>

          <p style="margin:0 0 20px;color:#c7f9df;line-height:1.8">
            استخدم رمز التحقق التالي لإكمال إنشاء مكتبك في Viresto.
          </p>

          <div dir="ltr" style="letter-spacing:8px;text-align:center;font-size:34px;font-weight:900;background:#071811;border-radius:18px;padding:18px;margin:22px 0;color:#d1fae5">
            ${safeCode}
          </div>

          <p style="margin:0 0 18px;color:#b7d9c8;line-height:1.8">
            الرمز صالح لمدة 10 دقائق.
          </p>

          <a href="${verifyUrl}" style="display:inline-block;background:#10b981;color:#052e1c;text-decoration:none;font-weight:900;border-radius:14px;padding:12px 18px">
            فتح صفحة التحقق
          </a>

          <p style="margin:22px 0 0;color:#86a899;line-height:1.8;font-size:13px">
            إذا لم تقم بطلب إنشاء حساب، تجاهل هذه الرسالة.
          </p>
        </div>
      </div>
    `,
    text: `رمز تأكيد البريد الإلكتروني الخاص بك هو: ${code}. الرمز صالح لمدة 10 دقائق. صفحة التحقق: ${verifyUrl}`,
  });

  if (error) {
    console.error("RESEND_EMAIL_ERROR:", error);
    throw new Error(
      typeof error.message === "string"
        ? error.message
        : "Failed to send verification email",
    );
  }
}