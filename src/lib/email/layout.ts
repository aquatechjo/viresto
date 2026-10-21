// القالب المشترك لكل إيميلات Viresto: داكن من الأساس (عشان Gmail، خصوصاً
// Android، ما يقلب الألوان)، RTL، جداول وinline styles (email-safe)، والـ media
// query للموبايل بس. كل إيميل بيمرّر المحتوى تبعه فقط (renderEmailLayout)،
// ومنه قطع جاهزة: العنوان، صندوق الرمز، الزر، جدول البيانات.
// للمعاينة محليًا: `npm run email:preview` (scripts/preview-emails.ts).

// ألوان هوية Viresto (src/app/globals.css، نفس ألوان اللاندنج الداكنة).
// التباين (WCAG): text على card 14.8:1، muted على card 6.1:1 وعلى page 7.2:1،
// وحدود accent 4.1:1 على card و5.2:1 على codeBg، ونص الزر (page) على accent 4.8:1.
export const C = {
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

// Gmail بيكيّش الصور حسب الرابط: كل ما يتغيّر ملف اللوجو، زيد هالرقم
// عشان الإيميلات الجديدة تجيب النسخة الجديدة (?v=N).
// 2: إطار نحاسي حول مربع الأيقونة (2026-10-21).
export const EMAIL_LOGO_VERSION = 2;

export const FONT = `'Segoe UI', Tahoma, 'Noto Sans Arabic', Arial, sans-serif`;

export const DEFAULT_APP_URL = "https://www.virestojo.com";

export type RenderedEmail = { subject: string; html: string; text: string };

/** For every value that comes from a user (names, emails, reasons, URLs). */
export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** A 6-digit OTP, digits only (nothing else can reach the HTML). */
export function otpDigits(code: string) {
  return code.replace(/\D/g, "").slice(0, 6);
}

export function baseUrl(appUrl: string) {
  return appUrl.replace(/\/+$/, "");
}

/**
 * The whole email around one card. `content` is the card's inner HTML,
 * built from the helpers below; `title` goes in <title> (the subject),
 * `preheader` is the notification / inbox preview line. Both are plain text.
 */
export function renderEmailLayout({
  title,
  preheader,
  appUrl = DEFAULT_APP_URL,
  content,
}: {
  title: string;
  preheader: string;
  appUrl?: string;
  content: string;
}) {
  const base = baseUrl(appUrl);
  const logoUrl = `${base}${EMAIL_LOGO.path}?v=${EMAIL_LOGO_VERSION}`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(title)}</title>
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
    ${escapeHtml(preheader)}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
    <tr>
      <td class="wrap" align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:460px;">

          <!-- الشعار: رابط كامل، ونص alt مرتب إذا الصور محجوبة -->
          <tr>
            <td align="center" style="padding:0 0 20px;" dir="ltr">
              <img src="${escapeHtml(logoUrl)}" width="${EMAIL_LOGO.width}" height="${EMAIL_LOGO.height}" alt="Viresto"
                   style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;width:${EMAIL_LOGO.width}px;height:${EMAIL_LOGO.height}px;font-family:${FONT};font-size:20px;font-weight:700;line-height:${EMAIL_LOGO.height}px;color:${C.text};text-align:center;">
            </td>
          </tr>

          <!-- البطاقة -->
          <tr>
            <td class="card" dir="rtl" style="background:${C.card};border:1px solid ${C.line};border-top:3px solid ${C.accent};border-radius:14px;padding:36px 32px;font-family:${FONT};text-align:right;">
${content}
            </td>
          </tr>

          <!-- الفوتر -->
          <tr>
            <td align="center" style="padding:22px 8px 0;font-family:${FONT};font-size:12px;line-height:1.8;color:${C.muted};">
              <a href="${escapeHtml(base)}" style="color:${C.muted};text-decoration:none;" dir="ltr">virestojo.com</a>
              <br>Viresto منتج من Aqua.Tech
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// --- قطع المحتوى (كلها HTML جاهز؛ النصوص من المستخدم لازم تمر بـ escapeHtml) ---

/** عنوان البطاقة. */
export function heading(html: string) {
  return `
              <h1 class="title" style="margin:0 0 10px;font-size:24px;line-height:1.4;font-weight:700;color:${C.text};">
                ${html}
              </h1>`;
}

/** السطر التعريفي تحت العنوان. */
export function lead(html: string) {
  return `
              <p style="margin:0 0 26px;font-size:15px;line-height:1.8;color:${C.muted};">
                ${html}
              </p>`;
}

/** فقرة نص عادي بالبطاقة. */
export function paragraph(html: string) {
  return `
              <p style="margin:0 0 16px;font-size:15px;line-height:1.8;color:${C.text};">
                ${html}
              </p>`;
}

/** ملاحظة صغيرة: الأولى بعد الرمز/الزر بمسافة أكبر، والباقي متلاصقة. */
export function note(html: string, first = false) {
  return `${first ? "\n" : ""}
              <p style="margin:${first ? "22px" : "8px"} 0 0;font-size:13px;line-height:1.8;color:${C.muted};">
                ${html}
              </p>`;
}

/** صندوق الرمز: dir=ltr + nowrap عشان ما ينكسر على سطرين. */
export function codeBox(digits: string) {
  return `

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
              </table>`;
}

/**
 * زر bulletproof: جدول وخلية ملوّنة (bgcolor + background) والرابط جواها،
 * فبيظهر زر حتى بالبرامج اللي بتتجاهل padding أو border-radius على <a>.
 * وتحته الرابط نفسه كنص للنسخ.
 */
export function button(href: string, label: string) {
  const url = escapeHtml(href);
  return `

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:4px auto 0;">
                <tr>
                  <td align="center" bgcolor="${C.accent}" style="background:${C.accent};border-radius:10px;">
                    <a href="${url}" target="_blank" rel="noopener"
                       style="display:inline-block;padding:14px 32px;border:1px solid ${C.accent};border-radius:10px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1.2;color:${C.page};text-decoration:none;">${escapeHtml(label)}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:22px 0 4px;font-size:13px;line-height:1.8;color:${C.muted};">
                إذا لم يعمل الزر، انسخ هذا الرابط والصقه في المتصفح:
              </p>
              <p dir="ltr" style="margin:0;font-size:12px;line-height:1.7;text-align:left;word-break:break-all;overflow-wrap:anywhere;">
                <a href="${url}" target="_blank" rel="noopener" style="color:${C.text};text-decoration:underline;word-break:break-all;">${url}</a>
              </p>`;
}

/** جدول بيانات مرتب: عنوان باهت يمين، وقيمة واضحة تحته. القيم HTML جاهز. */
export function details(rows: Array<[label: string, valueHtml: string]>) {
  const body = rows
    .map(
      ([label, value], index) => `
                <tr>
                  <td style="padding:12px 16px;${index ? `border-top:1px solid ${C.line};` : ""}">
                    <div style="font-size:12px;line-height:1.6;color:${C.muted};">${label}</div>
                    <div style="font-size:15px;line-height:1.7;font-weight:600;color:${C.text};word-break:break-word;overflow-wrap:anywhere;">${value}</div>
                  </td>
                </tr>`,
    )
    .join("");

  return `

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="margin:0 0 22px;background:${C.codeBg};border:1px solid ${C.line};border-radius:10px;font-family:${FONT};">${body}
              </table>`;
}

/** نص لاتيني (إيميل، رابط، معرّف) داخل جملة عربية: يحافظ على اتجاهه. */
export function ltr(html: string) {
  return `<span dir="ltr" style="unicode-bidi:isolate;">${html}</span>`;
}

/** وقت الحدث بتوقيت عمّان، بأرقام لاتينية. */
export function formatAmmanTime(date: Date) {
  return `${new Intl.DateTimeFormat("ar-JO-u-nu-latn", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Amman",
  }).format(date)} (بتوقيت عمّان)`;
}
