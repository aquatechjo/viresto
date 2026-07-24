import type { Metadata } from "next";
import LegalPageShell, {
  type LegalLocale,
  type LegalSection,
} from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Subscription, Cancellation & Refund Policy",
  description:
    "Viresto subscription, cancellation, renewal, and refund policy.",
  alternates: {
    canonical: "/subscription-policy",
  },
};

const CONTENT: Record<
  LegalLocale,
  { title: string; description: string; sections: LegalSection[] }
> = {
  ar: {
    title: "سياسة الاشتراك والإلغاء والاسترداد",
    description:
      "توضح هذه السياسة آلية التجربة والخطط المدفوعة والتجديد وتغيير الخطة والإلغاء والاسترداد في Viresto. تظهر الشروط التجارية النهائية بوضوح قبل تأكيد أي عملية دفع.",
    sections: [
      {
        heading: "1. الخطط والأسعار",
        paragraphs: [
          "تتوفر Viresto بخطط شهرية وسنوية موضحة في صفحة الأسعار وبالدينار الأردني. يَظهر السعر النهائي ودورة الفوترة وأي رسوم أو ضرائب واجبة قبل تأكيد الطلب. لا تُطبق زيادة سعرية على دورة مدفوعة جارية، ويُقدم إشعار مناسب قبل تأثير أي تغيير على التجديد التالي.",
        ],
      },
      {
        heading: "2. التجربة المجانية",
        paragraphs: [
          "يحصل المكتب الجديد المؤهل على تجربة مجانية لمدة 7 أيام وفق الخطة المعروضة عند التسجيل. لا تتحول التجربة إلى اشتراك مدفوع إلا بعد اختيار خطة وتقديم وسيلة دفع أو تأكيد طلب دفع. عند انتهاء التجربة دون اشتراك فعال، قد يصبح الحساب للقراءة فقط إلى أن يتم التفعيل.",
        ],
      },
      {
        heading: "3. الدفع والتجديد",
        paragraphs: [
          "عند استخدام الدفع الإلكتروني، تُعالج العملية عبر مزود دفع خارجي وتخضع أيضًا لشروطه الأمنية والتشغيلية. لا يخزن Viresto بيانات البطاقة الكاملة. يتجدد الاشتراك تلقائيًا فقط عندما توضح شاشة الطلب ذلك ويوافق العميل عليه صراحةً، ويكون التجديد وفق الدورة المختارة.",
          "الدفعات اليدوية، إن كانت متاحة، لا تتجدد تلقائيًا ما لم يتم الاتفاق على ذلك بوضوح. يُعد الاشتراك فعالًا بعد تأكيد استلام الدفعة وقبولها.",
        ],
      },
      {
        heading: "4. تغيير الخطة",
        paragraphs: [
          "يمكن طلب الترقية أو خفض الخطة من صفحة الاشتراك. تظهر قبل التأكيد آثار التغيير على السعر والحدود والتوقيت. قد تبدأ الترقية فورًا مع احتساب فرق مناسب، بينما يبدأ خفض الخطة عادةً في الدورة التالية لتجنب فقدان مفاجئ للخصائص. إذا تجاوز الاستخدام حدود الخطة الجديدة، يجب تخفيضه قبل إتمام التغيير أو يبقى الوصول مقيدًا حسبما توضحه شاشة الطلب.",
        ],
      },
      {
        heading: "5. الإلغاء",
        paragraphs: [
          "يمكن إلغاء التجديد من إعدادات الاشتراك أو عبر التواصل الرسمي. ما لم تُذكر نتيجة مختلفة عند الطلب، يوقف الإلغاء التجديد القادم ويستمر الوصول المدفوع حتى نهاية الدورة الحالية. لا يترتب على الإلغاء حذف بيانات المكتب تلقائيًا؛ يمكن طلب التصدير أو الإغلاق وفق سياسة الخصوصية.",
          "يجب تقديم طلب الإلغاء قبل موعد التجديد. إذا كانت عملية التجديد قد اكتملت بالفعل، يعامل الطلب وفق بند الاسترداد أدناه.",
        ],
      },
      {
        heading: "6. فشل الدفع والتأخر",
        paragraphs: [
          "عند فشل الدفع أو عكسه، نحاول إشعار مدير المكتب ومنحه فرصة معقولة لتحديث وسيلة الدفع أو تسوية المبلغ. قد تنتقل الخدمة إلى القراءة فقط أو تُعلّق الميزات المدفوعة إلى حين التسوية، مع الحفاظ على ضوابط حماية البيانات وعدم حذفها فورًا بسبب فشل دفعة واحدة.",
        ],
      },
      {
        heading: "7. الاسترداد",
        bullets: [
          "يمكن طلب استرداد أول دفعة مدفوعة خلال 7 أيام تقويمية من الشراء إذا لم يكن الحساب قد استخدم الخدمة استخدامًا جوهريًا أو استهلك موارد مدفوعة كبيرة.",
          "تُراجع الدفعات المكررة، والعمليات غير المصرح بها، والخصم الناتج عن خلل تقني، والخدمة غير المقدمة بسبب خطأ من Viresto، ويُعاد المبلغ المقبول وفق الحالة.",
          "رسوم الدورات السابقة أو المستهلكة وتجديدات الاشتراك لا تُسترد عادةً بعد بدء الدورة، إلا إذا أوجب القانون أو ثبت خلل جوهري أو تم قبول الطلب استثنائيًا.",
          "لا تحد هذه السياسة من أي حق في الإصلاح أو الاستبدال أو استرداد المقابل تقرره قواعد حماية المستهلك أو أي تشريع نافذ.",
        ],
        paragraphs: [
          "يجب أن يتضمن طلب الاسترداد بريد الحساب ورقم العملية وسبب الطلب دون إرسال بيانات بطاقة حساسة. بعد الموافقة، يُعاد المبلغ إلى وسيلة الدفع الأصلية متى كان ذلك ممكنًا، وتختلف مدة ظهوره بحسب مزود الدفع والبنك وسيتم توضيحها عند معالجة الطلب.",
        ],
      },
      {
        heading: "8. الاعتراضات على العمليات",
        paragraphs: [
          "يرجى التواصل معنا أولًا عند وجود عملية غير معروفة أو خلاف على الخدمة لنتمكن من التحقيق وتقديم السجلات اللازمة. لا يمنع ذلك العميل من ممارسة حقوقه لدى البنك أو مزود الدفع، ولا يجوز استخدام الاعتراض لاسترداد خدمة استُخدمت بصورة مشروعة.",
        ],
      },
      {
        heading: "9. تحديث السياسة",
        paragraphs: [
          "قد تُحدّث هذه السياسة عند إضافة بوابة دفع أو تغيير آلية الفوترة. لا يسري تغيير جوهري بأثر رجعي على دورة مدفوعة مكتملة، وسيظهر تاريخ النفاذ ويقدم إشعار مناسب قبل تطبيقه على التجديدات المستقبلية.",
        ],
      },
    ],
  },
  en: {
    title: "Subscription, Cancellation & Refund Policy",
    description:
      "This policy explains Viresto trials, paid plans, renewal, plan changes, cancellation, and refunds. Final commercial terms are displayed clearly before any payment is confirmed.",
    sections: [
      {
        heading: "1. Plans and prices",
        paragraphs: [
          "Viresto offers monthly and annual plans shown on the Pricing page in Jordanian dinars. The final price, billing interval, and applicable fees or taxes are displayed before confirmation. A price increase will not affect a current paid period, and appropriate notice will be given before it affects a future renewal.",
        ],
      },
      {
        heading: "2. Free trial",
        paragraphs: [
          "An eligible new office receives a 7-day free trial under the plan shown at registration. The trial becomes paid only after a plan is selected and a payment method or payment request is confirmed. When the trial ends without an active subscription, the account may become read-only until activation.",
        ],
      },
      {
        heading: "3. Payment and renewal",
        paragraphs: [
          "Electronic payments are processed by an external payment provider and are also subject to that provider's security and operational terms. Viresto does not store complete card details. A subscription renews automatically only where the order screen clearly states this and the customer expressly agrees, using the selected billing interval.",
          "Manual payments, where available, do not renew automatically unless this is clearly agreed. The subscription becomes active after the payment is confirmed and accepted.",
        ],
      },
      {
        heading: "4. Plan changes",
        paragraphs: [
          "Upgrades and downgrades can be requested from the subscription page. Price, limits, and timing effects are shown before confirmation. An upgrade may begin immediately with an appropriate adjustment, while a downgrade normally starts next period to avoid sudden feature loss. Usage above the new plan's limits must be reduced before the change or access may remain restricted as disclosed.",
        ],
      },
      {
        heading: "5. Cancellation",
        paragraphs: [
          "Renewal can be cancelled through subscription settings or the official contact channel. Unless the order states otherwise, cancellation stops the next renewal and paid access continues until the end of the current period. Cancellation does not automatically delete office data; export or closure can be requested under the Privacy Policy.",
          "Cancellation should be submitted before the renewal date. If renewal has already completed, the request is handled under the refund section below.",
        ],
      },
      {
        heading: "6. Failed or overdue payment",
        paragraphs: [
          "If a payment fails or is reversed, we will attempt to notify the office administrator and provide a reasonable opportunity to update payment or settle the amount. The service may become read-only or paid features may be suspended until resolution. Data is not immediately deleted because of a single failed payment.",
        ],
      },
      {
        heading: "7. Refunds",
        bullets: [
          "A first paid charge may be refunded when requested within 7 calendar days of purchase if the account has not materially used the service or consumed substantial paid resources.",
          "Duplicate, unauthorised, technically incorrect, or undelivered-service charges caused by Viresto are reviewed and approved refunds are issued according to the circumstances.",
          "Previous, substantially consumed, or renewed periods are normally non-refundable after the period starts unless required by law, a material defect is established, or an exception is approved.",
          "This policy does not limit any repair, replacement, refund, or other right granted by consumer-protection or other mandatory law.",
        ],
        paragraphs: [
          "A refund request should include the account email, transaction reference, and reason, without sending sensitive card data. Approved refunds are returned to the original payment method where possible. Timing depends on the payment provider and bank and will be communicated during processing.",
        ],
      },
      {
        heading: "8. Payment disputes",
        paragraphs: [
          "Please contact us first about an unrecognised charge or service dispute so we can investigate and provide relevant records. This does not restrict rights with a bank or payment provider, but a dispute must not be used to reclaim a service that was legitimately used.",
        ],
      },
      {
        heading: "9. Policy changes",
        paragraphs: [
          "This policy may be updated when a payment gateway is added or billing mechanics change. A material change will not retroactively alter a completed paid period. The effective date will be shown and appropriate notice will be provided before future renewals are affected.",
        ],
      },
    ],
  },
};

export default async function SubscriptionPolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  const params = await searchParams;
  const locale: LegalLocale = params.lang === "en" ? "en" : "ar";
  const content = CONTENT[locale];

  return (
    <LegalPageShell
      locale={locale}
      pathname="/subscription-policy"
      title={content.title}
      description={content.description}
      sections={content.sections}
    />
  );
}
