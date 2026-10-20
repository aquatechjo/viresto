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

const C = {
  page: "#0E1A27",    // خلفية الإيميل
  card: "#152536",    // البطاقة
  line: "#22364B",    // الحدود
  text: "#EAF0F6",    // نص أساسي
  muted: "#93A6BA",   // نص ثانوي
  brass: "#C9A24A",   // لون مميز (ختم/نحاس)
  codeBg: "#0B1622",  // خلفية الرمز
};

const FONT = `'Segoe UI', Tahoma, 'Noto Sans Arabic', Arial, sans-serif`;

export function renderVerificationEmail({
  code,
  minutes = EMAIL_VERIFICATION_TTL_MINUTES,
  appUrl = "https://www.virestojo.com",
}: VerificationEmailInput) {
  const digits = code.replace(/\D/g, "").slice(0, 6);
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

          <!-- الشعار -->
          <tr>
            <td align="center" style="padding:0 0 20px;font-family:${FONT};font-size:20px;font-weight:700;color:${C.text};letter-spacing:.5px;" dir="ltr">
              Viresto
            </td>
          </tr>

          <!-- البطاقة -->
          <tr>
            <td class="card" dir="rtl" style="background:${C.card};border:1px solid ${C.line};border-top:3px solid ${C.brass};border-radius:14px;padding:36px 32px;font-family:${FONT};text-align:right;">

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
                      style="background:${C.codeBg};border:1px solid ${C.brass};border-radius:10px;
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
