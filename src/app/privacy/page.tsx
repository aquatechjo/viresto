import type { Metadata } from "next";
import LegalPageShell, {
  type LegalLocale,
  type LegalSection,
} from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Viresto privacy policy and personal data practices.",
  alternates: {
    canonical: "/privacy",
  },
};

const CONTENT: Record<
  LegalLocale,
  { title: string; description: string; sections: LegalSection[] }
> = {
  ar: {
    title: "سياسة الخصوصية",
    description:
      "توضح هذه السياسة كيف تجمع Aqua Tech، بصفتها مشغّل منصة Viresto، البيانات الشخصية وتستخدمها وتحميها، وكيف يمكن للأشخاص المعنيين ممارسة حقوقهم.",
    sections: [
      {
        heading: "1. النطاق والأدوار",
        paragraphs: [
          "تنطبق هذه السياسة على موقع Viresto وتطبيقه وخدماته. بالنسبة لبيانات الحساب والتواصل والأمان والفوترة، تعمل Aqua Tech بصفتها المسؤول عن المعالجة. وبالنسبة لبيانات الموكلين والقضايا والمستندات التي يُدخلها المكتب، يحدد المكتب أغراض المعالجة وتعمل Aqua Tech عادةً بصفتها معالجًا لتقديم الخدمة نيابةً عنه.",
          "يجب على المكتب التأكد من وجود أساس قانوني مناسب لإدخال بيانات موكليه وأطراف القضايا إلى المنصة، وإبلاغهم عند وجوب ذلك.",
        ],
      },
      {
        heading: "2. البيانات التي نعالجها",
        bullets: [
          "بيانات إنشاء الحساب وإدارة المكتب: الاسم، اسم المكتب، البريد الإلكتروني، رقم الهاتف، الدور والصلاحيات.",
          "بيانات التشغيل التي يضيفها المستخدمون: بيانات الموكلين والقضايا والمواعيد والمهام والمستندات والفواتير والمدفوعات والملاحظات.",
          "بيانات الأمان والتقنية: عنوان IP، معلومات الجهاز والمتصفح، الجلسات، سجلات الدخول والنشاط ومحاولات الوصول.",
          "بيانات الاشتراك والفوترة وطلبات الدفع، دون تخزين بيانات البطاقة الكاملة داخل Viresto.",
          "محتوى يُرسل إلى مزود الذكاء الاصطناعي فقط عند تفعيل موافقة المكتب وطلب ميزة تعتمد عليه.",
        ],
      },
      {
        heading: "3. أغراض المعالجة وأساسها",
        bullets: [
          "إنشاء الحساب وتنفيذ عقد الخدمة وتشغيل خصائص Viresto.",
          "حماية الحسابات، منع إساءة الاستخدام، التدقيق والاستجابة للحوادث.",
          "إدارة الاشتراكات والدعم والتواصل التشغيلي وإرسال رسائل التحقق والاسترجاع.",
          "الامتثال للالتزامات القانونية والطلبات النظامية الملزمة.",
          "تحسين موثوقية الخدمة وأدائها بالاعتماد على بيانات تشغيلية محدودة، مع تقليل البيانات قدر الإمكان.",
        ],
        paragraphs: [
          "نعتمد، بحسب الحالة، على تنفيذ العقد، أو الموافقة المسبقة، أو الالتزام القانوني، أو المصالح المشروعة التي لا تتعارض مع حقوق الشخص المعني، وفق التشريعات النافذة.",
        ],
      },
      {
        heading: "4. الجهات التي قد تعالج البيانات",
        paragraphs: [
          "نستخدم مزودي خدمات تقنيين لتشغيل المنصة، مثل خدمات الاستضافة وقاعدة البيانات وتخزين الملفات والبريد الإلكتروني وتحديد معدل الطلبات. وقد تشمل هذه الجهات Vercel وNeon وCloudinary وResend وUpstash، ومزود الذكاء الاصطناعي عند تفعيل الميزة.",
          "لا نبيع البيانات الشخصية. ولا نشاركها إلا بالقدر الضروري لتقديم الخدمة، أو بموافقة مناسبة، أو امتثالًا لطلب قانوني ملزم. قد تتم المعالجة أو الاستضافة خارج الأردن مع اتخاذ الضوابط التعاقدية والتقنية المطلوبة وبما يراعي التشريعات النافذة.",
        ],
      },
      {
        heading: "5. الاحتفاظ والحذف",
        paragraphs: [
          "نحتفظ ببيانات الحساب ومحتوى المكتب طوال مدة الحساب وبالقدر اللازم لتقديم الخدمة وتسوية الالتزامات النظامية. تُحفظ سجلات النشاط التشغيلية عادةً لمدة 30 يومًا، وسجلات الأمان لمدة قد تصل إلى 365 يومًا، ما لم تستلزم حادثة أو التزام قانوني مدة أطول.",
          "عند طلب إغلاق الحساب، نحذف البيانات أو نخفيها أو نعيدها وفق طبيعتها، وحقوق الأطراف، ومتطلبات النسخ الاحتياطي والاحتفاظ النظامي. قد تستمر النسخ الاحتياطية المقيدة لفترة محدودة قبل تدويرها.",
        ],
      },
      {
        heading: "6. حقوق الأشخاص المعنيين",
        bullets: [
          "العلم بوجود البيانات والوصول إليها والحصول على نسخة منها.",
          "طلب التصحيح أو التحديث أو تقييد نطاق المعالجة.",
          "طلب المحو أو الإخفاء عندما يسمح القانون بذلك.",
          "سحب الموافقة والاعتراض على المعالجة أو التشخيص غير الضروري.",
          "تقديم شكوى إلى الجهة المختصة بحماية البيانات الشخصية.",
        ],
        paragraphs: [
          "يمكن إرسال الطلب إلى البريد الموضح أدناه. قد نطلب معلومات مناسبة للتحقق من الهوية والصلاحية، خصوصًا عندما يتعلق الطلب ببيانات يديرها مكتب محاماة داخل حسابه.",
        ],
      },
      {
        heading: "7. حماية البيانات",
        paragraphs: [
          "نطبق ضوابط تقنية وتنظيمية تشمل تشفير الاتصالات، تشفير بيانات حساسة محددة، عزل بيانات المكاتب، صلاحيات مبنية على الأدوار، التحقق بخطوتين، حماية الجلسات، سجلات تدقيق، فحص أنواع الملفات، وتقييد الوصول إلى المستندات الخاصة. لا توجد وسيلة تقنية تضمن أمانًا مطلقًا، لذلك نراجع الضوابط ونحدّثها بصورة مستمرة.",
        ],
      },
      {
        heading: "8. التحديثات والتواصل",
        paragraphs: [
          "قد نحدّث هذه السياسة عند تغير الخدمة أو المتطلبات القانونية. يظهر تاريخ النفاذ أعلى الصفحة، وسنقدم إشعارًا مناسبًا عند وجود تغيير جوهري. يمكن إرسال أسئلة الخصوصية وطلبات الحقوق إلى البريد الرسمي المبين أدناه.",
        ],
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    description:
      "This policy explains how Aqua Tech, the operator of Viresto, collects, uses, protects, and shares personal data, and how data subjects can exercise their rights.",
    sections: [
      {
        heading: "1. Scope and roles",
        paragraphs: [
          "This policy applies to the Viresto website, application, and services. Aqua Tech acts as controller for account, communications, security, and billing data. For client, case, and document data entered by a law office, the office determines the processing purposes and Aqua Tech generally acts as its processor to provide the service.",
          "Each office is responsible for having an appropriate legal basis to add client and case-party data and for providing any notices required by law.",
        ],
      },
      {
        heading: "2. Data we process",
        bullets: [
          "Account and office data, including names, office name, email, phone number, role, and permissions.",
          "Operational content entered by users, including clients, cases, appointments, tasks, documents, invoices, payments, and notes.",
          "Security and technical data, including IP address, browser and device details, sessions, sign-in records, activity logs, and access attempts.",
          "Subscription, billing, and payment-request data. Viresto does not store complete payment-card details.",
          "Content sent to an AI provider only when the office has enabled consent and requests a feature that uses it.",
        ],
      },
      {
        heading: "3. Purposes and legal bases",
        bullets: [
          "Creating accounts, performing the service agreement, and operating Viresto features.",
          "Protecting accounts, preventing misuse, auditing activity, and responding to incidents.",
          "Managing subscriptions, support, operational communications, verification, and recovery emails.",
          "Complying with legal obligations and binding lawful requests.",
          "Improving reliability and performance using limited operational data and data-minimisation practices.",
        ],
        paragraphs: [
          "Depending on the context, processing relies on performance of a contract, prior consent, a legal obligation, or legitimate interests that do not override data-subject rights, as permitted by applicable law.",
        ],
      },
      {
        heading: "4. Service providers and transfers",
        paragraphs: [
          "We use technical providers for hosting, databases, file storage, email delivery, and rate limiting. These may include Vercel, Neon, Cloudinary, Resend, Upstash, and an AI provider when the feature is enabled.",
          "We do not sell personal data. We disclose it only as needed to provide the service, with suitable consent, or to comply with a binding legal request. Processing or hosting may occur outside Jordan under appropriate contractual and technical safeguards and applicable legal requirements.",
        ],
      },
      {
        heading: "5. Retention and deletion",
        paragraphs: [
          "Account data and office content are retained while the account is active and as needed to provide the service and meet legal obligations. Operational activity logs are normally retained for 30 days and security logs for up to 365 days unless an incident or legal duty requires longer retention.",
          "When an account is closed, data is deleted, concealed, or returned according to its nature, third-party rights, backup cycles, and mandatory retention requirements. Restricted backups may remain for a limited period before rotation.",
        ],
      },
      {
        heading: "6. Data-subject rights",
        bullets: [
          "To know whether data is held, access it, and obtain a copy.",
          "To request correction, updating, or restriction of processing.",
          "To request erasure or concealment where the law permits.",
          "To withdraw consent and object to unnecessary processing or profiling.",
          "To submit a complaint to the competent personal-data authority.",
        ],
        paragraphs: [
          "Requests may be sent to the address below. We may request appropriate information to verify identity and authority, particularly where the request concerns data controlled by a law office inside its account.",
        ],
      },
      {
        heading: "7. Security",
        paragraphs: [
          "We use technical and organisational controls including encrypted transport, encryption for selected sensitive fields, tenant isolation, role-based permissions, two-factor authentication, session protection, audit logs, file-type validation, and restricted access to private documents. No system can guarantee absolute security, so controls are reviewed and updated regularly.",
        ],
      },
      {
        heading: "8. Changes and contact",
        paragraphs: [
          "We may update this policy when the service or legal requirements change. The effective date appears above, and material changes will receive appropriate notice. Privacy questions and rights requests can be sent to the official contact address below.",
        ],
      },
    ],
  },
};

export default async function PrivacyPage({
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
      pathname="/privacy"
      title={content.title}
      description={content.description}
      sections={content.sections}
    />
  );
}
