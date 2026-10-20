// قالب إيميل تأكيد البريد لـ Viresto — RTL، متجاوب، ومصمم داكن من الأساس
// عشان Gmail (خصوصاً Android) ما يقلب الألوان ويخربها.
// يُرسل من sendVerificationEmail في src/lib/email.ts. للمعاينة محليًا:
// `npm run email:preview` (scripts/preview-verification-email.ts).

import { EMAIL_VERIFICATION_TTL_MINUTES } from "@/lib/verification-policy";

type VerificationEmailInput = {
  code: string;          // "642332"
  minutes?: number;      // مدة الصلاحية (افتراضيًا نفس قيمة الباك إند)
  appUrl?: string;
};

// ألوان هوية Viresto (src/app/globals.css، نفس ألوان اللاندنج الداكنة).
// التباين (WCAG): text على card 14.8:1، muted على card 6.1:1 وعلى page 7.2:1،
// وحدود accent 4.1:1 على card و5.2:1 على codeBg.
const C = {
  page: "#041819",    // --landing-canvas: خلفية الإيميل
  card: "#0b292a",    // --landing-surface: البطاقة
  line: "#1c494a",    // --landing-border: الحدود
  text: "#f8fbfa",    // --brand-text: نص أساسي
  muted: "#86aaa6",   // --brand-text-muted: نص ثانوي
  accent: "#b87333",  // --landing-copper: اللون المميز (نحاس)
  codeBg: "#020e0f",  // --brand-canvas-deep: خلفية الرمز
};

// اللوجو (scripts/build-email-logo.mjs): PNG بضعف المقاس للشاشات retina،
// خلفيته شفافة. لو غيّرت المقاس، أعد توليده وحدّث هون.
export const EMAIL_LOGO = { path: "/email/viresto-logo.png", width: 131, height: 40 };

const FONT = `'Segoe UI', Tahoma, 'Noto Sans Arabic', Arial, sans-serif`;

export function renderVerificationEmail({
  code,
  minutes = EMAIL_VERIFICATION_TTL_MINUTES,
  appUrl = "https://www.virestojo.com",
}: VerificationEmailInput) {
  const digits = code.replace(/\D/g, "").slice(0, 6);
  const logoUrl = `${appUrl.replace(/\/+$/, "")}${EMAIL_LOGO.path}`;
  const subject = `${digits} رمز تأكيد بريدك في Viresto`;
  const preheader = `رمزك: ${digits} — صالح لمدة ${minutes} دقائق.`;

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${subject}</title>
<style>
  :root { color-scheme: dark; supported-color-schemes: dark; }
  body { margin:0; padding:0; }
  @media (max-width: 520px) {
    .wrap { padding: 20px 12px !important; }
    .card { padding: 28px 20px !important; }
    .title { font-size: 21px !important; }
    .code { font-size: 30px !important; letter-spacing: 6px !important; padding: 16px 8px 16px 14px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.page};">
  <!-- preheader: يظهر في الإشعار ومعاينة صندوق الوارد -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    ${preheader}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
    <tr>
      <td class="wrap" align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:460px;">

          <!-- الشعار: رابط كامل، ونص alt مرتب إذا الصور محجوبة -->
          <tr>
            <td align="center" style="padding:0 0 20px;" dir="ltr">
              <img src="${logoUrl}" width="${EMAIL_LOGO.width}" height="${EMAIL_LOGO.height}" alt="Viresto"
                   style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;width:${EMAIL_LOGO.width}px;height:${EMAIL_LOGO.height}px;font-family:${FONT};font-size:20px;font-weight:700;line-height:${EMAIL_LOGO.height}px;color:${C.text};text-align:center;">
            </td>
          </tr>

          <!-- البطاقة -->
          <tr>
            <td class="card" dir="rtl" style="background:${C.card};border:1px solid ${C.line};border-top:3px solid ${C.accent};border-radius:14px;padding:36px 32px;font-family:${FONT};text-align:right;">

              <h1 class="title" style="margin:0 0 10px;font-size:24px;line-height:1.4;font-weight:700;color:${C.text};">
                تأكيد البريد الإلكتروني
              </h1>
              <p style="margin:0 0 26px;font-size:15px;line-height:1.8;color:${C.muted};">
                أدخل هذا الرمز في Viresto لتأكيد بريدك.
              </p>

              <!-- الرمز: dir=ltr + nowrap عشان ما ينكسر على سطرين -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" dir="ltr" class="code"
                      style="background:${C.codeBg};border:1px solid ${C.accent};border-radius:10px;
                             padding:18px 10px 18px 22px;white-space:nowrap;
                             font-family:'Courier New', Consolas, monospace;font-size:36px;font-weight:700;
                             letter-spacing:12px;color:${C.text};line-height:1;">
                    ${digits}
                  </td>
                </tr>
              </table>

              <p style="margin:22px 0 0;font-size:13px;line-height:1.8;color:${C.muted};">
                ينتهي الرمز خلال ${minutes} دقائق. لا تشاركه مع أي شخص، فريق Viresto لن يطلبه منك.
              </p>
              <p style="margin:8px 0 0;font-size:13px;line-height:1.8;color:${C.muted};">
                إذا لم تطلب هذا الرمز، تجاهل الرسالة.
              </p>
            </td>
          </tr>

          <!-- الفوتر -->
          <tr>
            <td align="center" style="padding:22px 8px 0;font-family:${FONT};font-size:12px;line-height:1.8;color:${C.muted};">
              <a href="${appUrl}" style="color:${C.muted};text-decoration:none;" dir="ltr">virestojo.com</a>
              <br>Viresto منتج من Aqua.Tech
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    "تأكيد البريد الإلكتروني — Viresto",
    "",
    `رمز التأكيد: ${digits}`,
    `ينتهي خلال ${minutes} دقائق. لا تشاركه مع أي شخص.`,
    "إذا لم تطلب هذا الرمز، تجاهل الرسالة.",
  ].join("\n");

  return { subject, html, text };
}
