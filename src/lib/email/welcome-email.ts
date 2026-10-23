// ترحيب بمكتب جديد: بعد أول تأكيد ناجح لإيميل مؤسس المكتب. صندوق نحاسي
// للتجربة المجانية، ثلاث خطوات للبداية، وزر للوحة التحكم.
// يُرسل من sendWelcomeEmailAfterVerification في src/lib/welcome-email.ts.

import { APP_TRIAL_DAYS } from "@/lib/tenant-access";
import {
  C,
  DEFAULT_APP_URL,
  baseUrl,
  button,
  escapeHtml,
  formatAmmanTime,
  heading,
  lead,
  renderEmailLayout,
  type RenderedEmail,
} from "@/lib/email/layout";

export const WELCOME_EMAIL_SUBJECT = "مكتبك على Viresto جاهز";

// لو الاسم فاضي (ما لازم يصير، بس الإيميل ما بيطلع ناقص).
export const WELCOME_FALLBACK_USER_NAME = "حضرة المحامي";
export const WELCOME_FALLBACK_OFFICE_NAME = "مكتبك";

const STEPS: Array<[title: string, body: string]> = [
  ["أضف الموكّلين", "بيانات كل موكّل في مكان واحد، جاهزة لربطها بقضاياه."],
  ["افتح قضية وارفع مستنداتها", "كل ملفات القضية محفوظة معها ومتاحة لفريقك."],
  ["سجّل الجلسات", "مواعيد الجلسات وقراراتها مرتبة على كل قضية."],
];

/** صندوق التجربة: إطار نحاسي على خلفية codeBg، زي صندوق الرمز. */
function trialBox(endsAt: string) {
  return `

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;">
                <tr>
                  <td style="background:${C.codeBg};border:1px solid ${C.accent};border-radius:10px;padding:18px 20px;text-align:right;">
                    <div style="font-size:16px;line-height:1.6;font-weight:700;color:${C.accent};">
                      تجربة مجانية لمدة ${APP_TRIAL_DAYS} يومًا
                    </div>
                    <div style="margin:6px 0 0;font-size:14px;line-height:1.8;color:${C.text};">
                      بدون بطاقة دفع، وجميع الميزات متاحة.
                    </div>
                    <div style="margin:2px 0 0;font-size:14px;line-height:1.8;color:${C.text};">
                      موعد انتهاء التجربة: <span style="unicode-bidi:isolate;font-weight:700;">${endsAt}</span>
                    </div>
                    <div style="margin:6px 0 0;font-size:13px;line-height:1.8;color:${C.muted};">
                      بعد انتهائها يمكنك المتابعة باشتراك من قسم الاشتراكات في لوحة التحكم.
                    </div>
                  </td>
                </tr>
              </table>`;
}

/** الخطوات: رقم بدائرة نحاسية ونص بجانبه (جداول، مش flex). */
function steps() {
  const rows = STEPS.map(([title, body], index) => {
    const pad = index < STEPS.length - 1 ? "0 0 14px" : "0";
    return `
                <tr>
                  <td width="36" valign="top" style="width:36px;padding:${pad};">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" valign="middle" width="26" height="26" style="width:26px;height:26px;border:1px solid ${C.accent};border-radius:13px;font-size:13px;font-weight:700;line-height:26px;color:${C.accent};text-align:center;">${index + 1}</td>
                      </tr>
                    </table>
                  </td>
                  <td valign="top" style="padding:${pad};text-align:right;">
                    <div style="font-size:15px;line-height:1.7;font-weight:600;color:${C.text};">${title}</div>
                    <div style="font-size:13px;line-height:1.7;color:${C.muted};">${body}</div>
                  </td>
                </tr>`;
  }).join("");

  return `

              <p style="margin:0 0 12px;font-size:15px;line-height:1.8;font-weight:700;color:${C.text};">
                ثلاث خطوات للبداية:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">${rows}
              </table>`;
}

export function renderWelcomeEmail({
  userName,
  officeName,
  trialEndsAt,
  appUrl = DEFAULT_APP_URL,
}: {
  userName: string | null | undefined;
  officeName: string | null | undefined;
  trialEndsAt: Date;
  appUrl?: string;
}): RenderedEmail {
  const name = userName?.trim() || WELCOME_FALLBACK_USER_NAME;
  const office = officeName?.trim() || WELCOME_FALLBACK_OFFICE_NAME;
  const endsAt = formatAmmanTime(trialEndsAt);
  const dashboardUrl = `${baseUrl(appUrl)}/dashboard`;
  const subject = WELCOME_EMAIL_SUBJECT;

  const html = renderEmailLayout({
    title: subject,
    preheader: `تجربتك المجانية لمدة ${APP_TRIAL_DAYS} يومًا بدأت، بدون بطاقة دفع.`,
    appUrl,
    content: [
      heading(`أهلاً ${escapeHtml(name)}، مكتبك جاهز`),
      lead(
        `تم تجهيز حساب <span dir="auto" style="unicode-bidi:isolate;font-weight:600;color:${C.text};">${escapeHtml(office)}</span> على Viresto، ويمكنك البدء بالعمل عليه الآن.`,
      ),
      trialBox(escapeHtml(endsAt)),
      steps(),
      button(dashboardUrl, "افتح لوحة التحكم"),
      `

              <p style="margin:24px 0 0;padding:18px 0 0;border-top:1px solid ${C.line};font-size:13px;line-height:1.8;color:${C.muted};">
                لديك سؤال؟ رُدّ على هذا الإيميل مباشرة وسيصلك الرد من فريقنا.
              </p>`,
    ].join(""),
  });

  const text = [
    `أهلاً ${name}، مكتبك جاهز — Viresto`,
    "",
    `تم تجهيز حساب ${office} على Viresto، ويمكنك البدء بالعمل عليه الآن.`,
    "",
    `تجربة مجانية لمدة ${APP_TRIAL_DAYS} يومًا، بدون بطاقة دفع، وجميع الميزات متاحة.`,
    `موعد انتهاء التجربة: ${endsAt}`,
    "بعد انتهائها يمكنك المتابعة باشتراك من قسم الاشتراكات في لوحة التحكم.",
    "",
    "ثلاث خطوات للبداية:",
    ...STEPS.map(([title, body], index) => `${index + 1}. ${title}: ${body}`),
    "",
    `افتح لوحة التحكم: ${dashboardUrl}`,
    "",
    "لديك سؤال؟ رُدّ على هذا الإيميل مباشرة وسيصلك الرد من فريقنا.",
  ].join("\n");

  return { subject, html, text };
}
