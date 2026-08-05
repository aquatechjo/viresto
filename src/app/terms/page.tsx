import type { Metadata } from "next";
import LegalPageShell, {
  type LegalLocale,
  type LegalSection,
} from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Terms and conditions governing use of Viresto.",
  alternates: {
    canonical: "/terms",
  },
};

const CONTENT: Record<
  LegalLocale,
  { title: string; description: string; sections: LegalSection[] }
> = {
  ar: {
    title: "الشروط والأحكام",
    description:
      "تنظم هذه الشروط استخدام منصة Viresto التي تشغّلها Aqua Tech. إنشاء حساب أو استخدام المنصة يعني قبول هذه الشروط وسياسة الخصوصية وسياسة الاشتراك.",
    sections: [
      {
        heading: "1. الخدمة",
        paragraphs: [
          "Viresto منصة برمجية لإدارة أعمال مكاتب المحاماة، وتشمل أدوات للموكلين والقضايا والمواعيد والمهام والمستندات والفوترة والمدفوعات والتقارير وإدارة الفريق. المنصة أداة تشغيلية ولا تقدم استشارة قانونية ولا تستبدل الحكم المهني للمحامي.",
        ],
      },
      {
        heading: "2. الأهلية وصلاحية التعاقد",
        paragraphs: [
          "يجب أن يكون منشئ حساب المكتب مخولًا قانونيًا بالتعاقد وإدارة البيانات نيابةً عن المكتب، وأن يقدم معلومات صحيحة ومحدثة. لا يجوز مشاركة الحساب الفردي أو انتحال صفة شخص أو مكتب آخر.",
        ],
      },
      {
        heading: "3. الحساب والأمان",
        bullets: [
          "الحفاظ على سرية كلمة المرور وأجهزة التحقق والإبلاغ سريعًا عن أي وصول غير مصرح.",
          "منح أعضاء الفريق الحد المناسب من الصلاحيات وتعطيل حساب من لم يعد مخولًا.",
          "استخدام بريد إلكتروني ورقم هاتف يمكن الوصول إليهما لاستلام رسائل الأمان والتحقق.",
          "تحمل المكتب مسؤولية الأنشطة التي تتم عبر حساباته ما لم يثبت اختراق خارج عن سيطرته وبعد الإبلاغ دون تأخير.",
        ],
      },
      {
        heading: "4. بيانات المكتب والموكلين",
        paragraphs: [
          "يحتفظ المكتب بحقوقه في المحتوى الذي يرفعه. ويمنح Aqua Tech ترخيصًا محدودًا لمعالجة هذا المحتوى فقط لتشغيل Viresto وتأمينه ودعمه والامتثال للالتزامات القانونية.",
          "يتحمل المكتب مسؤولية مشروعية جمع البيانات وإدخالها ومشاركتها، والحصول على التفويضات والموافقات اللازمة، ودقة السجلات، والالتزام بواجبات السرية المهنية وأوامر المحاكم وقواعد المهنة.",
        ],
      },
      {
        heading: "5. الاستخدام المقبول",
        bullets: [
          "يُحظر رفع برمجيات ضارة أو ملفات غير مشروعة أو محتوى ينتهك حقوق الغير.",
          "يُحظر تجاوز الصلاحيات أو اختبار الأمان دون تصريح أو محاولة الوصول إلى بيانات مكتب آخر.",
          "يُحظر تعطيل الخدمة أو التحايل على حدود الخطط أو معدلات الطلبات أو آليات الحماية.",
          "يُحظر استخدام المنصة للاحتيال أو انتحال الهوية أو أي نشاط مخالف للقانون.",
        ],
      },
      {
        heading: "6. الاشتراك والتجربة والدفع",
        paragraphs: [
          "تخضع التجربة المجانية والخطط المدفوعة والأسعار والتجديد والإلغاء والاسترداد لسياسة الاشتراك والإلغاء والاسترداد وللمعلومات الظاهرة عند إتمام الطلب. عند التعارض في معلومة تجارية محددة، تسود التفاصيل التي وافق عليها العميل صراحةً عند الطلب، دون الإخلال بالحقوق التي لا يجوز التنازل عنها قانونًا.",
        ],
      },
      {
        heading: "7. خدمات الطرف الثالث والذكاء الاصطناعي",
        paragraphs: [
          "تعتمد بعض الوظائف على مزودي استضافة وتخزين وبريد وخدمات أخرى. وقد تتأثر الوظيفة بتوفر المزود الخارجي. ميزات الذكاء الاصطناعي اختيارية ولا تُفعّل لمعالجة محتوى المكتب إلا وفق إعدادات الموافقة. مخرجات الذكاء الاصطناعي قد تكون غير دقيقة ويجب مراجعتها بشريًا قبل الاعتماد عليها.",
        ],
      },
      {
        heading: "8. الملكية الفكرية",
        paragraphs: [
          "تعود حقوق منصة Viresto وبرمجياتها وتصميمها وعلاماتها ومحتواها الأصلي إلى Aqua Tech أو مرخصيها. لا تمنح هذه الشروط حق نسخ المنصة أو بيعها أو هندستها عكسيًا أو إنشاء خدمة منافسة من مكوناتها، باستثناء ما يسمح به القانون صراحةً.",
        ],
      },
      {
        heading: "9. توفر الخدمة والتغييرات",
        paragraphs: [
          "نسعى إلى تشغيل مستقر وآمن، لكن قد نحتاج إلى صيانة أو تحديثات أو استجابة لحادث أو تعطل مزود خارجي. سنبذل جهدًا معقولًا لتقليل الانقطاع وإشعار المستخدمين بالتغييرات الجوهرية. يجوز تطوير المزايا أو تعديلها مع المحافظة على جوهر الخطة المتعاقد عليها أو تقديم بديل مناسب.",
        ],
      },
      {
        heading: "10. التعليق والإنهاء",
        paragraphs: [
          "يجوز تعليق الوصول عند انتهاء التجربة أو عدم السداد أو وجود خطر أمني أو مخالفة جوهرية، وقد يتحول الحساب إلى وضع القراءة فقط حسب حالة الاشتراك. يمكن إنهاء الحساب عند استمرار المخالفة بعد إشعار مناسب، إلا إذا تطلب الخطر إجراءً فوريًا. تبقى أحكام السرية والملكية والالتزامات المستحقة سارية بعد الإنهاء.",
        ],
      },
      {
        heading: "11. المسؤولية",
        paragraphs: [
          "تُقدم المنصة كأداة إدارية، ويتحمل المكتب قراراته القانونية والمهنية ومواعيده ونسخه الأصلية وسلامة البيانات التي يدخلها. لا تستبعد هذه الشروط مسؤولية لا يجوز استبعادها قانونًا. وفي غير ذلك، تقتصر المسؤولية المباشرة لـAqua Tech عن المطالبات المتعلقة بالخدمة على الرسوم التي دفعها العميل عن الفترة التي نشأت خلالها المطالبة، ما لم يكن الضرر ناتجًا عن غش أو خطأ جسيم أو مخالفة لا يسمح القانون بتقييدها.",
        ],
      },
      {
        heading: "12. القانون والتواصل",
        paragraphs: [
          "تخضع هذه الشروط لقوانين المملكة الأردنية الهاشمية. يسعى الطرفان أولًا إلى تسوية النزاع وديًا، ثم تختص محاكم عمّان ما لم يفرض القانون اختصاصًا آخر. يمكن إرسال الإشعارات والأسئلة القانونية إلى info@aquatechagency.com، وبلاغات الأمان وطلبات الدعم إلى support@aquatechagency.com.",
        ],
      },
    ],
  },
  en: {
    title: "Terms & Conditions",
    description:
      "These terms govern use of Viresto, operated by Aqua Tech. Creating an account or using the platform constitutes acceptance of these terms, the Privacy Policy, and the Subscription Policy.",
    sections: [
      {
        heading: "1. The service",
        paragraphs: [
          "Viresto is software for law-practice operations, including tools for clients, cases, appointments, tasks, documents, billing, payments, reports, and team management. It is an operational tool, does not provide legal advice, and does not replace a lawyer's professional judgment.",
        ],
      },
      {
        heading: "2. Eligibility and authority",
        paragraphs: [
          "The person creating an office account must have legal capacity and authority to contract and manage data for that office, and must provide accurate, current information. Individual accounts may not be shared or used to impersonate another person or office.",
        ],
      },
      {
        heading: "3. Account security",
        bullets: [
          "Protect passwords and authentication devices and promptly report unauthorised access.",
          "Give team members only the permissions they need and deactivate access when authority ends.",
          "Maintain reachable email and phone details for verification and security notices.",
          "The office is responsible for activity through its accounts unless an external compromise is established and reported without delay.",
        ],
      },
      {
        heading: "4. Office and client data",
        paragraphs: [
          "The office retains its rights in uploaded content and grants Aqua Tech a limited licence to process it only to operate, secure, support, and legally maintain Viresto.",
          "The office is responsible for lawful collection and use, required authorisations and notices, record accuracy, professional confidentiality, court orders, and applicable professional rules.",
        ],
      },
      {
        heading: "5. Acceptable use",
        bullets: [
          "Do not upload malware, unlawful files, or content that infringes third-party rights.",
          "Do not exceed permissions, test security without authorisation, or access another office's data.",
          "Do not disrupt the service or bypass plan limits, rate limits, or security controls.",
          "Do not use Viresto for fraud, impersonation, or any unlawful activity.",
        ],
      },
      {
        heading: "6. Subscription, trial, and payment",
        paragraphs: [
          "The free trial, paid plans, prices, renewals, cancellation, and refunds are governed by the Subscription, Cancellation & Refund Policy and the information shown when an order is completed. For a specific commercial term, the details expressly accepted at the order stage prevail without limiting non-waivable statutory rights.",
        ],
      },
      {
        heading: "7. Third-party services and AI",
        paragraphs: [
          "Some functions rely on hosting, storage, email, and other providers and may be affected by provider availability. AI features are optional and office content is not submitted unless the relevant consent setting is enabled. AI output can be inaccurate and must be reviewed by a qualified person before use.",
        ],
      },
      {
        heading: "8. Intellectual property",
        paragraphs: [
          "Viresto software, design, marks, and original content belong to Aqua Tech or its licensors. These terms do not permit copying, resale, reverse engineering, or building a competing service from Viresto components except where applicable law expressly allows it.",
        ],
      },
      {
        heading: "9. Availability and changes",
        paragraphs: [
          "We aim for a stable and secure service, but maintenance, updates, incidents, or third-party outages may interrupt access. We will make reasonable efforts to minimise disruption and provide notice of material changes. Features may evolve while preserving the contracted plan's essential value or offering a suitable alternative.",
        ],
      },
      {
        heading: "10. Suspension and termination",
        paragraphs: [
          "Access may be suspended after trial expiry, non-payment, a security risk, or a material breach, and the account may become read-only according to subscription status. Continued breach may lead to termination after appropriate notice unless immediate action is required for safety. Confidentiality, ownership, and accrued obligations survive termination.",
        ],
      },
      {
        heading: "11. Liability",
        paragraphs: [
          "Viresto is an administrative tool. The office remains responsible for legal and professional decisions, deadlines, original copies, and the accuracy of entered data. Nothing excludes liability that cannot lawfully be excluded. Otherwise, Aqua Tech's direct liability for service claims is limited to fees paid for the period in which the claim arose, except for fraud, gross negligence, or another liability that applicable law does not permit us to limit.",
        ],
      },
      {
        heading: "12. Governing law and contact",
        paragraphs: [
          "These terms are governed by the laws of the Hashemite Kingdom of Jordan. The parties will first seek an amicable resolution, after which the courts of Amman have jurisdiction unless mandatory law requires otherwise. Legal notices and questions may be sent to info@aquatechagency.com, while security reports and support requests may be sent to support@aquatechagency.com.",
        ],
      },
    ],
  },
};

export default async function TermsPage({
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
      pathname="/terms"
      title={content.title}
      description={content.description}
      sections={content.sections}
    />
  );
}
