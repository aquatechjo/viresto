# Viresto — حالة المشروع (PROJECT_STATUS)

> آخر تحديث: 2026-09-25 (نموذج التجربة 14 يومًا + القفل من الخادم + إصلاحات webhook الخاص بـ Polar — القسم 2.1)
> الغرض: سياق جاهز لأي محادثة جديدة مع Claude. كل حالة هنا مأخوذة من git (commits + working tree) والكود نفسه وقت الكتابة. البنود التي لا يمكن التحقق منها من الكود مُعلَّمة بـ *(حسب المستخدم)*.

---

## 1. نظرة عامة

| البند | القيمة |
|---|---|
| المشروع | **Viresto** — نظام SaaS لإدارة مكاتب المحاماة (قضايا، عملاء، مواعيد، مستندات، فواتير، مالية، فريق). الواجهة عربية RTL وفيها دعم للغة الإنجليزية |
| Framework | Next.js `16.2.11` (App Router) + React `19.2` |
| اللغة | TypeScript `5.9` |
| ORM / DB | Prisma `5.22` + PostgreSQL |
| التنسيق | Tailwind CSS `3.4` + متغيرات CSS في `src/app/globals.css` (نظام VDS) |
| الدفع | Polar.sh (`@polar-sh/sdk ^0.49.0`) |
| الاستضافة | Vercel (`vercel.json`, `DEPLOY.md`, `OPERATIONS.md`) |
| الاختبارات | Unit: `node --test` عبر `tsx` (`npm run test:unit`) · E2E: Playwright (`tests/e2e`) · Load: k6 (`tests/k6`) |
| Git remote | `github.com/aquatechjo/...` — الفرع الحالي **`main`** |

---

## 2. تكامل الدفع (Polar.sh) — ✅ مكتمل

**Commits:** `2d5f48a` (التكامل) · `689eadb` (الاختبارات)

### المراحل
1. **Products:** 6 منتجات مُنشأة مسبقًا على Polar (كل خطة × دورة فوترة شهري/سنوي). **تصحيح (2026-09-25):** معرّفات المنتجات ليست في env vars، بل مثبتة في `prisma/seed.ts` (`POLAR_PRODUCT_IDS`) وتُكتب في جدول `BillingPlan` عبر `npm run db:seed`.
2. **Checkout** (`POST /api/billing/checkout`):
   - مشترك جديد ← `checkouts.create()` ينشئ Polar Checkout Session.
   - مستأجر عنده اشتراك `active`/`trialing` ← `subscriptions.update()` مباشرة **مع proration**. هذا يتجنب `AlreadyActiveSubscriptionError`، ويغطي upgrade وdowngrade.
   - يمنع التكرار الحقيقي فقط (نفس الخطة + نفس الدورة). تغيير الدورة وحده (مثل PRO شهري ← سنوي) مسموح.
   - الوصول لـ ADMIN فقط.
3. **Webhook** (`POST /api/billing/webhooks/polar`): يتحقق من التوقيع (standardwebhooks)، ويزامن أحداث `subscription.*` مع جدول `Subscription`. في `order.paid` يجلب الاشتراك الكامل قبل المزامنة. الأحداث غير المعروفة تُقبل بدون مزامنة، وفشل المزامنة يعيد 500.
4. **التحقق من البيئة:** `scripts/check-env.mjs` يتحقق من 4 متغيرات Polar إلزامية، فأي نقص يفشل بشكل واضح عند البناء/النشر.

### الملفات الرئيسية
- `src/lib/polar.ts` — عميل Polar وربط المنتجات
- `src/lib/polar-subscription-sync.ts` — منطق المزامنة
- `src/app/api/billing/checkout/route.ts`
- `src/app/api/billing/webhooks/polar/route.ts`
- `src/app/api/billing/route.ts`
- `src/app/dashboard/billing/page.tsx` — أُعيدت كتابتها بالكامل
- `prisma/schema.prisma` + migration، `prisma/seed.ts`، `.env.example`، `scripts/check-env.mjs`

### الاختبار
- **Production:** تم اختبار checkout حقيقي على الإنتاج بنجاح *(حسب المستخدم)*.
- **Unit tests المضافة للدفع: 13 اختبارًا**
  - `tests/unit/billing-checkout-route.test.ts` — 7
  - `tests/unit/billing-webhook-route.test.ts` — 6 (التحقق من التوقيع حقيقي وغير mocked، بسر اختبار فعلي)
  - الـ mocking يتم عبر `mock.module()` الموجود في `node:test`، ولهذا أُضيف `--experimental-test-module-mocks` إلى سكربت `test:unit` (Node 24).

---

### ⚠️ إصلاح حرج — 2026-09-25 (`cf169aa`)
- **webhooks الخاصة بـ Polar كانت تُرفض بـ 401 من الـ proxy قبل وصولها للـ handler.** `/api/billing/webhooks/polar` لم يكن في `MACHINE_AUTHENTICATED_PATHS` (`src/lib/request-path-policy.ts`) ولا في `publicPaths`، وطلبات Polar لا تحمل كوكي `ld_token`. النتيجة: لم يُزامَن أي اشتراك من الـ webhooks في الإنتاج قبل هذا الـ commit (نجاح الـ checkout لا يعني أن المزامنة نجحت). الـ unit tests لم تكتشف ذلك لأنها تستدعي الـ route مباشرة دون الـ proxy.
- الإصلاح: إضافة المسار الحرفي إلى القائمة. الـ handler يتحقق من التوقيع أصلًا. تم التحقق على dev: POST غير موقّع ← 403 من الـ handler (كان 401 من الـ proxy)، و`/api/billing/checkout` بدون جلسة ما زال 401.

## 2.1 نموذج الفوترة: تجربة داخل التطبيق 14 يومًا + إصلاحات webhook الخاص بـ Polar — ✅ مكتمل ومرفوع (2026-09-25)، ⏳ غير منشور

### القرارات (من المستخدم)
- كل مكتب جديد يبدأ **بتجربة مجانية داخل التطبيق لمدة 14 يومًا** (بلا بطاقة) بمزايا Pro. **لا توجد تجربة على جهة Polar** (المستخدم يزيلها يدويًا من المنتجات الستة، والـ checkout يرسل `allowTrial: false` كاحتياط).
- بعد انتهاء التجربة بلا دفع: **قفل كامل من الخادم** باستثناء الاشتراك/الفوترة، إعدادات الحساب، وتسجيل الخروج. لا حذف لأي بيانات. الدفع يفتح كل شيء فورًا.
- الدفع ينهي التجربة فورًا، والفترة المدفوعة تبدأ لحظة الشراء.
- **past_due:** وصول كامل + شريط أحمر "فشل الدفع، حدّث بطاقتك" (EN+AR) برابط لبوابة عميل Polar. القفل عند إلغاء/إبطال Polar للاشتراك أو بعد **7 أيام** في past_due، أيهما أسبق.
- **مهلة التجديد:** 48 ساعة بعد نهاية الفترة لاشتراكات Polar المتجددة فقط، ولا مهلة لـ `cancel_at_period_end`.
- **فتح فوري عند العودة من الـ checkout:** من الخادم فقط وبعد التحقق (انظر `fceea7a`).

### الـ Commits
| Commit | ما تم |
|---|---|
| `3ac98b7` | التجربة الصريحة: `register` ينشئ صف `Subscription` بحالة `TRIALING`، بلا `polarSubscriptionId`، بمبلغ 0 وعملة USD، مع `trialStartsAt`/`trialEndsAt` (عمود جديد nullable، migration `20260925000000`). مصدر قرار واحد: `src/lib/tenant-access.ts` (`resolveTenantAccess` → `PAID`/`TRIAL`/`LOCKED`). `billing-limits` صار يشتق منه. تعديل نص سياسة الاشتراك (7 ← 14 يومًا). |
| `5750f64` | القفل من الخادم داخل `requireAuth`/`requireRole` (كل routes المكتب تمر منهما): `402 { code: SUBSCRIPTION_REQUIRED, reason }`. المسموح: `/api/auth/*`، `/api/billing/*`، و`GET /api/settings`. مدير النظام مستثنى. الكاش (5 ثوانٍ) يُمسح في `invalidateAuthCacheForTenant`. الواجهة: `SubscriptionGate` يحوّل المكتب المقفول إلى `/dashboard/billing?locked=1` (تجربة استخدام فقط؛ الحماية في الـ API). |
| `d22a098` | صفحة الاشتراك: "تجربة مجانية: بقي X يومًا، تنتهي في DATE" + زر "اشترك الآن"، وبطاقة الحالة المقفولة. التجربة تظهر كـ "تجربة مجانية (مزايا Pro)" وليست Pro، ولا تُعلَّم أي خطة كحالية حتى الدفع الفعلي (قبلها كان زر Pro الشهري معطّلًا أثناء التجربة). غير المدراء يرون الإشعار مع "اطلب من مدير المكتب". شريط كهرماني في كل الداشبورد في آخر 3 أيام. |
| `53fc2bc` | إصلاح webhook (مكتشف من تسليم إنتاج حقيقي): tenant من `metadata.tenantId` أولًا، ثم الربط الموجود لنفس اشتراك Polar، ثم `customer.external_id` كاحتياط فقط؛ التعارض يُسجَّل `tenant_mismatch` والثقة بالـ metadata؛ اشتراك مربوط بمكتب آخر يُرفض (`tenant_conflict`) ولا يُنقل. معالجة `subscription.revoked` (كان يُتجاهل!)، `.uncanceled`، `.past_due`. عمود `pastDueSince` (migration `20260925010000`). منتجات التطبيق الآخر على نفس منظمة Polar ← 200 وتجاهل قبل أي استدعاء. أحداث بتوقيع صحيح لا يفهمها الـ SDK ← 200 بدل 500 يعيده Polar للأبد. `POST /api/billing/portal` لبوابة العميل. سطر log واحد لكل فشل: `[polar-webhook] <reason> key=value` (ids فقط). `paused` صار `EXPIRED` بدل `PAST_DUE`. |
| `599b787` | اشتراك Polar مستحق يغلق صف التجربة فورًا (`CANCELLED`، `cancelledAt` = `currentPeriodEnd` = الآن، وتبقى تواريخ التجربة للتاريخ). `allowTrial: false` في الـ checkout. |
| `fceea7a` | `POST /api/billing/checkout/confirm`: عند العودة بـ `checkout_id={CHECKOUT_ID}` يتحقق الخادم من Polar (الحالة succeeded/confirmed، `metadata.tenantId` = مكتب المستخدم، المنتج من منتجاتنا الستة، والاشتراك من نفس الـ checkout والمنتج والمكتب) ثم يزامن. أي فشل ← `{synced:false, reason}` بلا كتابة، والصفحة تنتظر الـ webhook كما كانت. |
| `27fee9d` | `scripts/migrate-offices-to-app-trial.ts`: dry run افتراضيًا، والكتابة فقط بـ `--apply`. **لم يُشغَّل على الإنتاج.** |

### إجابات للمستخدم (موثّقة)
- **`external_id`:** الكود يضعه فقط في الـ checkout كـ `externalCustomerId: tenantId`، أي أنه **tenantId** وليس userId. Polar يحتفظ بأول external_id رآه لنفس الإيميل، لذلك القيمة `cmpsq0nwo0002uog46vzfs9q2` غالبًا مكتب/محاولة سابقة بنفس الإيميل (معرّف أقدم من `cmughejyn…` حسب بادئة الوقت في cuid، استنتاج)، أو من Aqua Growth Engine. للتحقق: `SELECT id, name, "createdAt" FROM "Tenant" WHERE id = 'cmpsq0nwo0002uog46vzfs9q2';`
- **الـ 403:** التحقق عبر `validateEvent` من الـ SDK على الـ body الخام، والسر كما يعطيه Polar (مع `.trim()`). يمكن أن يفشل بسر صحيح إذا: كان في متغير Vercel مسافة/سطر جديد/علامات تنصيص (عولج بـ trim)، أو السر لـ endpoint آخر (المنظمة مشتركة مع Aqua Growth Engine)، أو لم يُعَد النشر بعد تغيير المتغير / ضُبط لـ Preview فقط، أو الحدث أقدم من 5 دقائق.

### التحقق
- `tsc` نظيف والـ unit tests قبل كل commit: 127 ← 145 ← 145 ← 172 ← 175 ← 187 ← **191/191**. `eslint` نظيف للملفات المعدّلة.
- الاختبارات المطلوبة موجودة: إنشاء التجربة (`register-trial`، `tenant-access`)، قفل انتهاء التجربة (`subscription-lockout`)، الشراء ينهي التجربة، تعارض الـ tenant، حالة trialing، تجاهل المنتج الأجنبي (`polar-subscription-sync`، `billing-webhook-route`)، إضافة لـ past_due، الـ confirm، وتصنيف الـ migration.
- **على dev** (فرع Neon dev، host مطابق لـ `E2E_ALLOWED_DATABASE_HOST`): طُبّقت الـ migrations الاثنتان. بمكتب اختبار مؤقت (حُذف بعدها): شريط آخر 3 أيام، بطاقة التجربة EN/AR، أزرار الخطط الثلاث كلها "اشترك الآن"، التحويل لصفحة الاشتراك عند القفل، `/api/cases` و`/api/clients` و`/api/dashboard-stats` ← 402 بينما `/api/auth/me` و`/api/billing` و`GET /api/settings` ← 200، صفحة الإعدادات تعمل، الشريط الأحمر لـ past_due مع استمرار القراءة والكتابة، وطلب الـ confirm عند العودة. **لم يُضغط "تحديث وسيلة الدفع"** لأن `.env` فيه مفتاح Polar الإنتاجي.
- الـ dry run للسكربت على dev: (a)=0، (b)=1 (مكتب E2E)، (c)=1.

### ملاحظات وانحرافات
- التسجيل كان ينشئ تجربة أصلًا (7 أيام، JOD، غير مميزة عن اشتراك Polar)، وليس اشتراك Pro مدفوعًا. صارت صريحة.
- قبل هذا، انتهاء الاشتراك كان "قراءة فقط" (الكتابة ممنوعة فقط). الآن قفل كامل.
- تعريف "تجربة داخل التطبيق" = `TRIALING` بلا `polarSubscriptionId` (يشمل صفوف التجربة القديمة بلا `trialStartsAt`). مسار الأدمن لا ينشئ `TRIALING`.
- عند فتح صفحة مقفولة تظهر لحظيًا رسالة خطأ من الصفحة (مثل "Failed to load cases") قبل التحويل. تجميلي، لم يُعالج.
- الـ proxy لا يفحص الاشتراك (لا DB فيه)؛ الحماية في `requireAuth`. الـ server actions الوحيدة (`admin/actions.ts`) خاصة بمدير النظام.
- الكاش in-memory لكل instance: بعد الدفع قد تبقى instances أخرى دافئة على القفل حتى 5 ثوانٍ.
- `checkout` لا يعتبر `PAST_DUE` اشتراكًا حيًا، فاختيار خطة أثناء past_due يبدأ checkout جديدًا (قد يرفضه Polar). لم يُعالج.

## 3. تنظيف نظام الدفع اليدوي القديم (CliQ / تحويل بنكي) — ✅ مكتمل

**Commits:** `2d5f48a` (الجزء الأكبر) · `5fd940d` (البقايا)

المحذوف:
- **Models:** `ManualPaymentSettings`، و`SubscriptionPayment` مع الـ FKs المرتبطة به (عبر migration مستقل).
- **Routes:** `api/admin/manual-payment-settings`، `api/admin/manual-payments/*` (list/approve/reject/receipt)، `api/billing/manual-payment/*`، `api/billing/change-plan`.
- **UI:** `ManualPaymentSettingsPanel.tsx`، `ManualPaymentsPanel.tsx`، واجهة رفع الإيصالات، عدّاد المدفوعات المعلقة في لوحة الأدمن، وبند checklist في `TenantDeletionControls`.
- **Lib:** `src/lib/manual-payment-settings.ts`، والـ exports غير المستخدمة (`RECEIPT_UPLOAD_MIME_TYPES`، `ManualPaymentPricingSnapshot`، `validateManualPaymentPricingSnapshot`) مع اختباراتها.
- مسار حذف المستأجر لم يعد يعتمد على `OPEN_MANUAL_PAYMENT_STATUSES`، ولم يعد ينظف موارد إيصالات Cloudinary.
- التحقق تم عبر grep شامل (صفر إشارات متبقية في `src/` و`schema.prisma`)، ونجحت `tsc` و`eslint` و`test:unit` بعد كل خطوة.

---

## 4. تحسينات الأداء — ✅ مكتمل

### Auth cache — commit `3e98af1`
- `AUTH_CACHE_TTL_MS` صار قابلًا للضبط من env، **والافتراضي 5000ms** (كان مثبتًا على 0 منذ `6fd14cd`). الهدف تقليل استعلامات DB المتكررة خلال دفعة طلبات API في نفس تحميل الصفحة.
- المنطق في `src/lib/api-auth.ts`، وفيه 3 دوال invalidation.
- **نقاط الـ invalidation الثمانية** (كل عملية حساسة أمنيًا تمسح الكاش فورًا بدل انتظار انتهاء الـ TTL):

| # | العملية | الدالة | الملف |
|---|---|---|---|
| 1 | Logout | `invalidateAuthCacheForSession` | `api/auth/logout` |
| 2 | إلغاء جلسة واحدة | `invalidateAuthCacheForSession` | `api/auth/session/revoke` |
| 3 | إلغاء باقي الجلسات | `invalidateAuthCacheForUser` | `api/auth/session/revoke-others` |
| 4 | إعادة تعيين كلمة المرور | `invalidateAuthCacheForUser` | `api/auth/reset-password` |
| 5 | تغيير البريد | `invalidateAuthCacheForUser` | `api/auth/change-email` |
| 6 | تغيير دور/تفعيل عضو فريق، أو حذفه | `invalidateAuthCacheForUser` | `api/team/[id]` |
| 7 | تعطيل مستخدم من الأدمن | `invalidateAuthCacheForUser` | `src/app/admin/actions.ts` |
| 8 | تعليق / حذف مستأجر | `invalidateAuthCacheForTenant` | `api/admin/tenants/[id]` + `admin/actions.ts` |

- الاختبارات: `tests/unit/api-auth-cache.test.ts` (4 اختبارات) تثبت إعادة استخدام الكاش داخل الـ TTL، والإبطال الفوري للدوال الثلاث.

### ضغط الشعارات — commit `6dd80da`
- `public/logo.png`: من 1024² (1.08MB) إلى 160² (~15.7KB).
- `public/viresto-logo.png`: من 1024² (1.08MB) إلى 256² (~34KB). أُبقي أكبر لأنه مستخدم في PDF الفواتير.

### إضافي — commit `ee186a9`
- `loading.tsx` و`error.tsx` مخصصة (skeleton ورسائل خطأ عربية) لـ `dashboard/billing` و`dashboard/cases`.

---

## 5. تجاوب الموبايل (Mobile Responsiveness) — 🟡 جزئي

### ✅ تم الإصلاح — commit `94cb033`
- **Viewport meta:** أُضيف `export const viewport` في `src/app/layout.tsx`. قبله كانت كل الصفحات تُعرض بعرض سطح المكتب على الهاتف.
- **Hamburger menu للصفحة الرئيسية** في `src/app/page.tsx`: روابط Features وPricing وGet Started لم تكن متاحة تحت `md`.

### ✅ تم الإصلاح — 2026-09-24
- **محتوى الصفحات كان مخفيًا تحت الـ TopBar على الشاشات الأضيق من 640px** (bug في الإنتاج) — commit `820b603`. السبب أن قاعدة `.dashboard-page-shell { padding: 1rem }` في `globals.css` تتغلب على `pt-[...]`، والحل `!pt-[...]`.
- **نقل البحث إلى الـ drawer في الموبايل** — commit `15196f2`:
  - الـ TopBar صار صفًا واحدًا تحت `xl`، والبحث في أعلى الـ drawer.
  - مكوّن مشترك واحد: `src/components/layout/DashboardSearch.tsx`.
  - اختيار نتيجة يغلق الـ drawer، ولا autofocus عند فتحه.
  - نتائج البحث صارت داكنة دائمًا، وهذا أصلح أيضًا عدم قراءتها في light على الديسكتوب.
  - جرى التحقق عند 375px بالعربية والإنجليزية وفي الوضعين.
- حذف `GlobalSearch.tsx` غير المستخدم — commit `6cacbc2`.

### ✅ تم الإصلاح — 2026-09-24 (جولة ثانية: الجداول، التقويم، التنبيهات، سجل النشاط)
- **قائمة التنبيهات (Bell) تخرج عن الشاشة** — commit `5b11d54`: تحت `sm` صارت `fixed inset-x-3 top-16 max-h-[70vh] overflow-y-auto`، وفوق `sm` بقي السلوك الأصلي (anchored) لكن بـ `start/end` منطقية بدل `left/right`. تأكدنا من عدم ازدحام أزرار الـ TopBar (ثيم/لغة/جرس/بروفايل) عند 360px بالحساب اليدوي لعرض كل عنصر (لا حاجة لتعديل، كانت كافية أصلًا).
- **تقويم المواعيد (FullCalendar) يفيض أفقيًا** — commit `28f960f`: السبب كان `@media (max-width:768px) { .appointments-calendar .fc { min-width: 700px } }` في `globals.css` داخل حاوية `overflow-x: auto` — أُزيل، وصار الجدول `table-layout: fixed` بعرض 100%. تحت `sm` أسماء الأيام تصير حرفًا واحدًا (ح ن ث ر خ ج س / SMTWTFS) والأحداث نقطة بدل النص الكامل، عبر كشف عرض الشاشة بـ `matchMedia` في `AppointmentsCalendar.tsx` (المكوّن مستورد بـ `dynamic(..., { ssr:false })` أصلًا، فلا يوجد خطر hydration mismatch).
- **جدول واحد قابل لإعادة الاستخدام:**
  - `VDSDataTable` (يستخدمه `cases`، `clients`، `team`، `activity`) — commit `24ca222`: صار عنده عرض بطاقات مكدّسة تحت `md` (جدول حقيقي فوقها بدون تغيير)، وحقل عمود جديد `mobileHidden` لإخفاء عمود من البطاقة، وسمة `data-vds-view="mobile-cards" / "desktop-table"` على كل نسخة لتمييزها بالاختبارات.
  - مكوّن جديد `src/components/ui/ResponsiveTable.tsx` لنفس النمط للجداول التي لم تكن تستخدم `VDSDataTable` — commit `dab5a9d`: مُطبّق على جدولي "دفعات الفترة" و"فواتير الفترة" في `dashboard/finance/reports` (وأصلح أيضًا ظهور صف الهيدر بدون بيانات في حالة الفراغ). جدولا `dashboard/finance/payments` و`dashboard/finance/invoices` (القائمة الرئيسية، فيها تعديل حالة الدفعة وclick-through) أبقيا على الجدول التفاعلي الأصلي من `md` فما فوق (`hidden md:block`)، وأُضيف لهما عرض بطاقات للقراءة فقط تحت `md` (بدون تعديل الحالة من البطاقة، لتفادي إعادة بناء منطق التعديل التفاعلي مرتين).
- **سجل النشاط (`dashboard/activity`) يكرر نفس النص** — commit `e1d3c74`: بعض الأنواع (مثل تسجيل دخول من جهاز/IP جديد) كان العنوان والرسالة والـ badge الثلاثة يعرضون نفس الجملة بالضبط من نفس قاموس الترجمة. صار الخلية تُخفي الرسالة والـ badge لو طابقا العنوان حرفيًا، وأُزيلت عروض `min-w-[...]` ثابتة كانت تفترض صف جدول عريض.
- **زر المساعد الذكي العائم يغطي على الجوّال** — commit `631e2bb`: صار الزر ولوحة المحادثة يضيفان `env(safe-area-inset-bottom)` لموضع `bottom` (بدون تأثير على الأجهزة بدون notch/gesture bar).
- **اختبارات Playwright جديدة** — commit `796d6e6`: `tests/e2e/mobile-responsive.spec.ts` (390×844) يسجّل دخول ويتأكد `document.documentElement.scrollWidth <= window.innerWidth` على 9 صفحات، بالإضافة لاختبار مخصص لقائمة التنبيهات والتقويم، مع لقطات شاشة لكل صفحة تحت `test-results/mobile-screenshots/`. نفس شرط التخطي الموجود بالملفات الأخرى (`E2E_TEST_EMAIL`/`PASSWORD`). بما إن `VDSDataTable`/`ResponsiveTable` يعرضان الآن نسختين (بطاقات + جدول) بنفس الوقت بالـ DOM (وحدة مخفية بـ CSS حسب حجم الشاشة)، أي `getByText` على نص ظاهر بالجدول ممكن يطابق عنصرين ويفشل بـ strict-mode violation — عُدِّل `tests/e2e/create-case.spec.ts` ليحدد `[data-vds-view="desktop-table"]` صراحة.

**التحقق:**
- `tsc --noEmit` و`eslint` نظيفان لكل الملفات المعدَّلة.
- **لم يُنفَّذ Playwright كاملًا بنجاح بهاي الجلسة.** تشغيل `npm run test:e2e` (3 workers بالتوازي) + محاولات دخول يدوية عبر المتصفح أدّت لـ `POST /api/auth/login → 429 Too Many Requests` (rate limiter بالذاكرة، لأنه Upstash غير مضبوط بالتطوير — انظر القسم 9). هذا أثّر حتى على `login.spec.ts` الأصلي (غير المعدَّل بهاي الجلسة)، فمو ريغريشن من هالتغييرات، بس **الاختبارات لسا ما تأكّد نجاحها فعليًا**. يُنصح بإعادة التشغيل لاحقًا بـ `npx playwright test --workers=1` بعد ما تنتهي نافذة الـ rate limit (بالذاكرة، تعيد تصفير نفسها لوحدها).
- **فحص بصري مباشر بالمتصفح لصفحات الداشبورد لم يكتمل** لنفس سبب الـ 429. تم التحقق فقط بمراجعة الكود والحسابات اليدوية للعرض (مثال: أزرار الـ TopBar عند 360px).

### 🟡 معلّق (من تقرير الـ responsiveness الأصلي، لم يُنفّذ بعد)
- [ ] **جداول لم تُهاجَر بعد** (بقيت بتمرير أفقي داخلي محتوى — لا تُسبب overflow لمستوى الصفحة، بس ما زالت بحاجة عرض بطاقات):
  - `src/app/admin/page.tsx` (لوحة الأدمن)
  - `src/app/dashboard/clients/[id]/page.tsx` و`src/app/dashboard/cases/[id]/page.tsx` (جداول فرعية بصفحة تفاصيل الموكل/القضية)
- [ ] **أزرار أصغر من معيار اللمس (44×44px)** في `login` و`register` ومكوّن `Modal` (أزرار الإغلاق/الإجراءات).
- [ ] **مشكلة RTL في `src/components/pricing/PricingSection.tsx`**: اتجاه/محاذاة غير صحيحة في RTL.

---

## 5.1 تجهيز الإطلاق: أسعار USD، الصفحات القانونية، الـ footer — ✅ مكتمل (2026-09-25)

| Commit | ما تم |
|---|---|
| `8281e64` | `src/config/plans.ts` صار المصدر الوحيد لأسعار **USD** المطابقة لمنتجات Polar: Basic ‏29/290، Pro ‏59/590، Business ‏119/1190 (الحقول `priceUsd`/`priceYearlyUsd`، و`PLAN_CURRENCY = "USD"`، والمبالغ بالسنت ×100). تقرأ منه: الصفحة الرئيسية، `/pricing`، `api/billing`، `subscription-consistency`، و`prisma/seed.ts`. ملاحظة "وفّر" السنوية صارت تُحسب من الأسعار: **"وفّر قيمة شهرين / save two months"** (السنوي = 10 أشهر)، بدل "شهر" القديمة. `formatMoney` في لوحة الأدمن صار يقسم حسب العملة (كان يقسم مبالغ Polar بالسنت على 1000). حُذف نص تسعير قديم غير مستخدم ($19/$49/Enterprise) من `page.tsx`. |
| `36abee0` | FAQ: ‏Enterprise ← Business (EN + AR). |
| `8f6ef2d` | Footer: "Viresto — a product by Aqua.Tech" / "Viresto — أحد منتجات Aqua.Tech" برابط `https://www.aquatechagency.com` (يُقرأ من `COMPANY_CONTACT.websiteUrl`/`operatorName`)، والإيميلات كما هي. |
| `5070944` | الصفحات القانونية: الاشتراكات بالـ USD عبر Polar، ولا يُقبل CliQ أو التحويل البنكي أو الدفع اليدوي لاشتراكات المنصة (مع التوضيح أن فواتير المكتب لموكليه منفصلة). Polar مُدرج كمعالج دفع في سياسة الخصوصية. المشغّل صار "Aqua.Tech" في كل الصفحات القانونية. **تاريخ النفاذ و`TERMS_VERSION`/`PRIVACY_VERSION` ← `2026-09-25`** (تُسجَّل فقط عند التسجيل، ولا تفرض إعادة موافقة). |
| `0a44138` | `/pricing`: فواصل الآلاف ($1,190) لتطابق الصفحة الرئيسية. |
| `cf169aa` | إصلاح webhook الخاص بـ Polar (انظر القسم 2). |

**لم يتغيّر:** فوترة الموكلين داخل التطبيق (فواتير/دفعات المكتب) بقيت بالـ JOD.

**التحقق:** `tsc` والـ unit tests (114/114، منها 2 جديدة للأسعار) قبل كل commit، و`eslint` نظيف للملفات المعدّلة. فحص بالمتصفح للصفحة الرئيسية بالعربي والإنجليزي (الأسعار، ملاحظة التوفير، FAQ، الـ footer) و`/pricing`.

**انحراف:** commit `8f6ef2d` نُفّذ بينما كان `tsc` يفشل، لأن أمر الـ commit لم يكن مشروطًا بنجاح `tsc`. سبب الفشل ملف مولَّد تالف (`.next/dev/types/routes.d.ts`) كتبه dev server أثناء التشغيل، وليس الكود. أُعيد توليد الملف، و`tsc` نظيف على نفس الشجرة. صارت كل الـ commits التالية مشروطة بـ `&&`.

## 6. توحيد الألوان بين landing page والداشبورد — ✅ مكتمل

### القرار
- **Landing page هي المرجع** لتناسقها مع الشعار. **الداشبورد هو الذي يتغيّر** ليطابقها.
- التركيز على **dark mode**. light mode لم يتغيّر بصريًا، باستثناء إصلاح زرّي الـ Sidebar المكسورين.
- صفحات `login/register/verify-email/join-team/legal/PricingSection` والصفحة الرئيسية **لم تُلمس**، لأنها المرجع.

### نظام المتغيرات النهائي (`src/app/globals.css`)
| المجموعة | الاستخدام | light | dark |
|---|---|---|---|
| `--brand-*` | ألوان تتبع الثيم (داخل `dark:`) | فاتح | لوحة الـ landing |
| `--landing-*` (جديد) | أسطح داكنة في الوضعين: Sidebar، TopBar، GlobalSearch، DatePicker، مودالات | ثابت | ثابت |
| `--accent-text` (جديد) | نصوص وأيقونات بارزة على البطاقات | `#082c2d` | `#dfb184` (نحاسي landing) |
| `--accent-fill` (جديد) | تعبئات تحمل نصًا أبيض (chips نشطة، أشرطة، avatar) | `#082c2d` | `#185354` |
| `--success` / `--danger` / `--warning` | دلالات نجاح/مدفوع، خطأ، تحذير | — | — |
| `--sidebar*` | chrome فقط: الـ Sidebar وتدرّجات hero | `#082c2d` | `#041819` |

### ما تم (مرتّب زمنيًا)
| البند | Commit |
|---|---|
| Phase 1: متغيرات CSS، و`--success` كمصدر وحيد | `f507eaf` |
| إصلاح زرّي الـ Sidebar (إغلاق الموبايل + زر القائمة): كانا أبيض على أبيض في light، وأُضيفت `--landing-*` | `714fcbe` |
| استبدال ~60 استخدام لـ `var(--sidebar)` كلون محتوى بـ `--accent-*`/`--success`. التباين في dark كان ~1.2:1، أي نص غير مرئي | `4c3e1f9` |
| استبدال hex الداشبورد بـ tokens (108 في 16 ملف)، و`#dc2626`/`#b45309` بـ `--danger`/`--warning`، والـ Sidebar يتبع `--sidebar`، وزر إنشاء موكل صار نحاسيًا | `bd4298d` |

### التحقق
- `tsc` نظيف لكل commit على حدة (`714fcbe`، `4c3e1f9`، `bd4298d`)، و`eslint` بلا أخطاء.
- فحص بصري في الوضعين للصفحات: الرئيسية، الموكلين + مودال الإنشاء، الجلسات، التقويم، الاشتراك. القيم قيست فعليًا بـ `getComputedStyle`.
- الكلاسات التي عليها opacity (`/90`، `/70`...) تحافظ على الشفافية. بقيت hex حرفية لأن Tailwind 3 لا يطبّق alpha على `var()`.

### ملاحظات لمن يكمل
- **ألوان مقصودة بقيت كما هي:** نص داكن على pill أبيض (`background: "#fff"`، `color: var(--sidebar)`) مقروء في الوضعين، فبقي على `--sidebar`.
- **ألوان خارج النطاق:** ألوان light-mode (مثل `text-[#0f3d3e]` بلا `dark:`)، وألوان الرسوم البيانية والحالات، ونسخة الطباعة في `invoices/[id]`.
- **أزرار FullCalendar — تعديلات أُلغيت (revert):** عدّلتُ زر "اليوم" والأزرار النشطة (شهر/أسبوع/يوم) في `globals.css` لتستخدم `--accent-*`، ثم أُلغيت هذه التعديلات قبل الـ commit لأنها بلا أي أثر بصري. السبب أن قواعد موجودة تتغلب عليها: الأزرار النشطة يحكمها `.fc .fc-button-primary:not(:disabled).fc-button-active { background: var(--sidebar-dark) !important }` ذات specificity أعلى، وزر "اليوم" في dark يحكمه `.dark .fc-button`. النتيجة: الزر النشط `#041819` في light (بلا تغيير) و`#020e0f` في dark (من Phase 1). القواعد الأضعف التي تشير لـ `--sidebar` صارت dead CSS، ويمكن حذفها لاحقًا.
- `RevenueChart` يستخدم `#b87333` كـ SVG attribute، فلا يمكن استبداله بـ `var()` هناك.

---

## 7. الجلسات وأمان تسجيل الدخول — ✅ مكتمل (2026-09-24)

كل القيم في `src/lib/session-policy.ts` (مصدر واحد للخادم والعميل):

| الإعداد | القيمة |
|---|---|
| مهلة الخمول `SESSION_IDLE_TIMEOUT_MS` | 30 دقيقة (كانت 5، ومعرّفة مرتين) |
| التحذير قبل الخروج `SESSION_IDLE_WARNING_MS` | 60 ثانية |
| الحد الأقصى المطلق `SESSION_ABSOLUTE_TIMEOUT_MS` | 12 ساعة، وهو أيضًا عمر الـ JWT والكوكي (كان 7 أيام) |
| عمر المسودات `FORM_DRAFT_MAX_AGE_MS` (في `src/lib/form-draft.ts`) | 24 ساعة |

| Commit | ما تم |
|---|---|
| `d33fe07` | مربع تحذير "هل ما زلت هنا؟" بعدّاد و"البقاء متصلًا / تسجيل الخروج الآن" (عربي/إنجليزي، الوضعان). النشاط = click/keydown/scroll/touchstart فقط (أُزيل mousemove)، والتمرير داخل اللوحات يُحتسب. أُضيف trailing ping حتى لا ينتهي الخادم قبل العميل. |
| `9d0179b` | `lastActivityAt` يتجدد فقط من `/api/auth/session/activity` وطلبات الكتابة (POST/PUT/PATCH/DELETE). قبلها كان poll الإشعارات كل 60 ثانية يُبقي أي تبويب مفتوح حيًا على الخادم للأبد. |
| `e6231db` | حد مطلق 12 ساعة يُفحص على `Session.createdAt`، حتى للمدخلات المخزنة في الكاش. لا migration. |
| `1a451ad` | `useFormDraft`: المسودات في `sessionStorage` بمفتاح `userId`، وتنتهي بعد 24 ساعة، والحقول الحساسة لا تُحفظ أبدًا. تُستعاد بعد خروج الخمول، وتُحذف عند الإلغاء أو الحفظ أو الخروج اليدوي. مفعّلة في: إنشاء موكل، إنشاء قضية، تعديل قضية (ويشمل الملاحظات)، إنشاء فاتورة، إنشاء مهمة. |
| `2b4f9e0` | بعد خروج الخمول: `/login?next=<الصفحة>&reason=idle`، والعودة لنفس الصفحة. `next` يُتحقق منه عبر `safeNextPath` (`src/lib/safe-redirect.ts`) ضد open redirect: يُرفض `//` والـ backslash والـ schemes والمسافات والأحرف الخاصة وكل صيغها المرمّزة. |
| `8b6b388` | إصلاح: رسالة سبب الخروج لم تكن تظهر في صفحة الدخول (الـ Toaster لم يكن مشتركًا بعد). |

**التحقق:**
- الاختبارات 106/106، منها 20 جديدة.
- التحذير جُرّب بمهلة مؤقتة 3 دقائق: ظهر عند الثانية 120، و"البقاء متصلًا" أرسل ping، والخروج التلقائي ألغى الجلسة على الخادم. ثم أُعيدت القيمة إلى 30 دقيقة.
- `next` أعاد المستخدم إلى `/dashboard/cases`.
- مسودة "إنشاء قضية" حُفظت، وبقيت بعد unload، واستُعيدت مع رسالة، وحُذفت عند الإلغاء.

**مقايضات أمنية مقبولة:**
- 30 دقيقة نافذة أطول على جهاز غير مقفل.
- المسودات نص واضح في `sessionStorage`، وتُمسح بإغلاق التبويب.
- النقر الآلي يمكنه تمديد الخمول، لكن ليس أبعد من حد الـ 12 ساعة.

---

## 8. Git — حالة الـ commits

- **الفرع:** `main`
- **آخر commit للكود/الإعداد:** `27fee9d` — `chore: add a dry-run-by-default script to move old offices onto the trial` (2026-09-25)، ويليه commit تحديث هذا الملف.
- **حالة الـ push:** `main` = `origin/main`. **كل الـ commits مرفوعة** (آخر دفعة: `3ac98b7` → `27fee9d`، ثم commit الـ docs هذا). **غير منشورة على الإنتاج بعد.**
- **معلّق محليًا (غير ملتزم، عن قصد):**
  - `next-env.d.ts`: عدّله dev server تلقائيًا، لا يُلتزم به.
  - `.claude/` (untracked): فيه `launch.json` لخادم التطوير.
  - **تعديلات المستخدم غير الملتزمة (لم تُلمس في جلستي 2026-09-25):** `.gitignore`، `playwright.config.ts`، `src/app/admin/page.tsx`، `src/app/dashboard/cases/[id]/page.tsx`، `src/app/dashboard/clients/[id]/page.tsx`، `src/app/dashboard/finance/payments/page.tsx`، `src/lib/rate-limit.ts`، `tests/e2e/*.spec.ts`، و`tests/e2e/global-setup.ts` (untracked).

**تسلسل الـ commits (الأقدم أولًا):**
`2d5f48a` Polar ← `5fd940d` تنظيف CliQ ← `689eadb` اختبارات الدفع ← `6dd80da` ضغط الشعارات ← `3e98af1` auth cache ← `ee186a9` loading/error boundaries ← `94cb033` viewport + hamburger ← `f507eaf` ألوان Phase 1 ← `714fcbe` إصلاح Sidebar ← `4c3e1f9` `--accent-*` ← `bd4298d` hex → tokens ← `7654314` PROJECT_STATUS.md ← `820b603` إصلاح padding الموبايل ← `15196f2` بحث الـ drawer ← `6cacbc2` حذف GlobalSearch ← `d33fe07` مهلة 30 دقيقة + تحذير ← `9d0179b` تجديد الجلسة بالنشاط فقط ← `e6231db` حد 12 ساعة ← `1a451ad` المسودات ← `2b4f9e0` next آمن ← `8b6b388` رسالة سبب الخروج ← `1a3da05` تحديث الحالة ← `3609528` CLAUDE.md (قاعدة مزامنة الحالة) ← `71326bb` رسالة تحقق نموذج القضية ← `201cf4e` fail-closed لمهلة Upstash في الإنتاج ← `b506091` اختبار E2E لإنشاء القضية + `seed:e2e` المحمي ← `b345088` تحديث الحالة ← `5b11d54` إصلاح قائمة التنبيهات بالموبايل ← `28f960f` إصلاح تقويم المواعيد بالموبايل ← `24ca222` بطاقات موبايل لـ `VDSDataTable` ← `dab5a9d` `ResponsiveTable` + هجرة جداول المالية ← `e1d3c74` إزالة تكرار سجل النشاط بالموبايل ← `631e2bb` منطقة آمنة لزر المساعد الذكي ← `796d6e6` اختبارات Playwright لتجاوب الموبايل ← `3319920` تحديث الحالة ← `8281e64` أسعار USD ← `36abee0` FAQ Business ← `8f6ef2d` footer ‏Aqua.Tech ← `5070944` الصفحات القانونية ← `0a44138` فواصل آلاف `/pricing` ← `cf169aa` إصلاح webhook الخاص بـ Polar ← `39e0c95` تحديث الحالة ← `3ac98b7` تجربة 14 يومًا ← `5750f64` القفل من الخادم ← `d22a098` عدّاد التجربة والشريط ← `53fc2bc` إصلاحات webhook + past_due ← `599b787` الشراء ينهي التجربة ← `fceea7a` الفتح الفوري ← `27fee9d` سكربت ترحيل المكاتب

---

## 9. ملاحظات بيئية مهمة

### الـ Hooks المكسورة (Security Guidance + Pixeltable) — ✅ أُصلح (2026-09-24)، ويتطلب إعادة تشغيل Claude Desktop
- **الأعراض:** إشعار "Push/Commit security review found issues" بعد كل commit/push، و"hook blocking error" بعد كل Write/Edit. **إنذار كاذب**: لم تُجرَ أي مراجعة أمنية فعلية أصلًا، والكتابة والـ commit ينجحان.
- **الـ hooks المتأثرة:**
  - `security-guidance` v2.0.8 (plugin_01YBNfaNwQztYsnUydt8m47G) ← `security_reminder_hook.py`
  - `pixeltable` v2.11.2 (plugin_01HuktqZUKz58qgxUm1mfuh6) ← `validate_antipatterns.py`
- **السبب الجذري (تم التحقق منه 2026-09-24):** الملفات **موجودة** على القرص، لكن Python الوحيد على الجهاز هو نسخة **Microsoft Store** (`WindowsAppsPythonSoftwareFoundation.Python.3.13_…`). هذه النسخة تعمل داخل sandbox (MSIX)، فلا ترى ملفات `AppDataRoamingClaude…`. `os.path.exists` يعيد `False` لملف موجود فعلًا.
- **الإصلاح المُطبّق:** ثُبّت Python 3.13.15 من python.org عبر `winget install -e --id Python.Python.3.13 --source winget --scope user`، ومساره في user PATH قبل `WindowsApps`. أُضيفت نسخة `python.exe` باسم `python3.13.exe` في `%LOCALAPPDATA%ProgramsPythonPython313`، لأن `sg-python.sh` يجرّب `python3.13` أولًا، والاسم الوحيد بهذا الشكل كان الـ Store alias. تم التحقق: كلا الـ hookين يعملان (exit 0). **للتراجع:** احذف `python3.13.exe` من ذلك المجلد. **حل بديل أنظف:** عطّل aliases الـ python في Windows Settings ← Apps ← Advanced app settings ← App execution aliases.

### تسجيل الدخول يرجع 429 تحت التوازي — لاحظناه 2026-09-24
- تشغيل `npx playwright test` بدون `--workers=1` (الافتراضي كان 3 workers) بالتوازي مع محاولات دخول يدوية عبر المتصفح أدّى لـ `POST /api/auth/login → 429 Too Many Requests` على كل المحاولات اللاحقة لفترة. السبب: rate limiter **بالذاكرة** (in-memory) لأنه `Upstash env vars are missing` بالتطوير — أي محدود بعملية السيرفر نفسها ولا يُميّز بين "محاولات خاطئة" و"تحميل متزامن حقيقي"، فأي تشغيل متوازٍ لعدة اختبارات E2E بيستهلك الحصة بسرعة.
- **الأثر:** كل اختبارات E2E اللي بتحتاج دخول فشلت بهاي الجلسة (حتى `login.spec.ts` الأصلي غير المعدَّل) — مو خلل بكود الموبايل المُضاف، بس **لازم تشغيل الاختبارات لاحقًا بـ `--workers=1`** (أو بعد تصفير نافذة الـ rate limit) للتأكد الفعلي.

### بيئة Windows
- Windows 11، والـ shell الأساسي **PowerShell 5.1**: لا يدعم `&&`، ويُستخدم `;` أو `if ($?) { ... }` بدلًا منه. أداة Bash (Git Bash) متاحة أيضًا لأوامر POSIX.
- تحذيرات `LF will be replaced by CRLF` من git طبيعية وغير مؤثرة.
- المسار: `C:\Users\HP\Desktop\Viresto`
- خادم التطوير: `npm run dev` (منفذ 3000)، ومعرّف في `.claude/launch.json` باسم `viresto-dev`.
- الاختبارات: `npm run test:unit` (يتطلب Node 24 بسبب `--experimental-test-module-mocks`)، و`npm run test:e2e` (Playwright يقرأ `.env.local`).
- رسائل الـ commit تنتهي بسطر `Co-Authored-By` الخاص بـ Claude.

---

## 10. قيد التنفيذ، التالي، والبنود المفتوحة

> **قاعدة دائمة (في `CLAUDE.md`، commit `3609528`):** بعد كل push يُحدَّث هذا الملف في commit مستقل باسم `docs: update PROJECT_STATUS` ويُرفع أيضًا، ولا يُخلط مع commits الميزات.

### ✅ تم (2026-09-24)
- `71326bb` — `fix: name the missing fields in the case form validation message`: رسالة التحقق في نموذج القضية تذكر الحقول الناقصة فعلًا، ومنها المحامي المسؤول.
- `201cf4e` — `fix: fail closed on Upstash rate-limit timeouts in production`: مهلة Upstash في الإنتاج ترفض الطلب بدل تمريره، مع اختبارات وحدة.
- `b506091` — `test: add create-case E2E spec and guarded seed:e2e script`: `create-case.spec.ts` مع `data-testid` لحقلي بحث الموكل وعنوان القضية، ومهل `login.spec.ts` أصبحت 45 ثانية، و`npm run seed:e2e` (`prisma/seed-e2e.ts`) الذي يرفض العمل إلا إذا كان host الـ `DATABASE_URL` مساويًا لـ `E2E_ALLOWED_DATABASE_HOST`، ولا يلمس إلا إيميلات نطاقات الاختبار.
- **تهيئة قاعدة dev** (فرع Neon dev، تأكّد المستخدم من لوحة Neon أن الـ endpoint المستخدم في `.env` تابع لفرع dev):
  - كانت الجداول موجودة و`_prisma_migrations` فارغًا. **انحراف عن الخطة:** لم تُعلَّم كل الـ migrations كمنفّذة. `migrate diff` أظهر أن القاعدة مطابقة حتى `20260922010000_drop_manual_payment_settings`، لكن جدول `SubscriptionPayment` (فارغ) ما زال موجودًا. لذلك عُلّمت 53 migration بـ `migrate resolve --applied`، وطُبّقت الأخيرة `20260922020000_drop_subscription_payment` فعليًا عبر `npm run db:deploy`. النتيجة: `Database schema is up to date!`.
  - `npm run db:seed` (3 خطط) ثم `npm run seed:e2e` (أُنشئ `test-e2e@example.com`، ADMIN في `e2e-test-office` باشتراك PRO فعّال).
  - `E2E_ALLOWED_DATABASE_HOST` في `.env.local` كان مضبوطًا مسبقًا على host الـ pooler لفرع dev.

### ✅ تم (2026-09-25)
- تجهيز الإطلاق: أسعار USD، FAQ، footer، الصفحات القانونية، وإصلاح webhook الخاص بـ Polar. انظر القسم 5.1 والقسم 2.
- نموذج التجربة 14 يومًا، القفل من الخادم، past_due، الفتح الفوري، وإصلاحات webhook من تسليم الإنتاج (`3ac98b7` → `27fee9d`). انظر القسم 2.1.

### قيد التنفيذ
- لا شيء.

### التالي (مقترح)
1. **تشغيل `npx playwright test --workers=1`** (بعد تصفير نافذة الـ 429 — انظر القسم 9) والتأكد من نجاح `login.spec.ts`، `create-case.spec.ts`، و`mobile-responsive.spec.ts` الجديد فعليًا. لم يكتمل تشغيلها بنجاح بهاي الجلسة.
2. **فحص بصري مباشر** لصفحات الداشبورد على 360/390/430px (تنبيهات، تقويم، الفريق، سجل النشاط، المالية) — لم يتم لنفس سبب الـ 429، والتحقق الحالي كان بمراجعة الكود فقط.
3. **فصل dev عن مفاتيح الإنتاج** (انظر "بانتظارك").
4. **هجرة الجداول المتبقية** لعرض البطاقات: `admin/page.tsx`، والجداول الفرعية بـ `clients/[id]` و`cases/[id]` (انظر القسم 5).
5. **بنود الموبايل المعلّقة** في القسم 5: أزرار اللمس، و RTL في PricingSection.
6. **تنظيف:** حذف `clients/new` وحذف CSS التقويم الميت.

### ⏳ بانتظارك
- [ ] **🚀 نشر نموذج التجربة (القسم 2.1) — بالترتيب:**
  - [ ] **أولًا `npm run db:deploy` على قاعدة الإنتاج** (migrationان إضافيتان nullable: `trialStartsAt`، `pastDueSince`). **قبل نشر الكود**، لأن `npm run build` لا يطبّق migrations، و`requireAuth` صار يقرأ هذه الأعمدة في كل طلب: نشر الكود قبلها يكسر كل الـ API.
  - [ ] نشر `27fee9d` (أو أحدث) على Vercel.
  - [ ] **Polar ← Webhooks:** إضافة الأحداث `subscription.revoked`، `subscription.uncanceled`، `subscription.past_due` إلى الموجودة.
  - [ ] إزالة التجربة من المنتجات الستة في Polar (أنت، يدويًا).
  - [ ] `npx tsx --env-file=<ملف env الإنتاج> scripts/migrate-offices-to-app-trial.ts` (dry run)، مراجعة الأعداد وقائمة (b)، ثم نفس الأمر مع `--apply` لمنح المجموعة (a) تجربة 14 يومًا من لحظة التشغيل. قرار مكاتب (b) يدويًا.
  - [ ] التحقق من `external_id` بالاستعلام في القسم 2.1، و redeliver لتسليم الإنتاج الفاشل بعد النشر (يجب أن يفعّل المكتب `cmughejyn0001149coe7u22sh` وليس `cmpsq0nwo…`).
  - [ ] بعد النشر: مراقبة `[polar-webhook]` في Vercel logs.
- [ ] **🚀 قبل الإطلاق (2026-09-25) — Polar والإنتاج:**
  - [ ] **نشر `cf169aa` على الإنتاج**، وإلا تبقى الـ webhooks مرفوضة بـ 401.
  - [ ] **Polar dashboard ← Settings ← Webhooks:** الـ URL بالضبط `https://www.virestojo.com/api/billing/webhooks/polar` (نفس الـ host الأساسي، بدون redirect)، الصيغة Raw/JSON، والأحداث: `subscription.created`، `subscription.active`، `subscription.updated`، `subscription.canceled`، `subscription.uncanceled`، `subscription.revoked`، `subscription.past_due`، `order.paid`. أي حدث آخر يُقبل (200) ويُتجاهل.
  - [ ] بعد النشر: "Send test event"/redeliver من Polar، والتأكد من 200 (403 = السر لا يطابق، 401 = النسخة المنشورة قديمة).
  - [ ] **Vercel (Production) env vars بالاسم:** `POLAR_ACCESS_TOKEN`، `POLAR_WEBHOOK_SECRET`، `POLAR_ORGANIZATION_ID`، `POLAR_ENVIRONMENT` (= `production`)، و`APP_URL` و/أو `NEXT_PUBLIC_APP_URL`.
  - [ ] **تشغيل `npm run db:seed` على قاعدة الإنتاج** لتحديث `BillingPlan` إلى `USD` والأسعار بالسنت، والتأكد أن معرّفات المنتجات في `prisma/seed.ts` هي منتجات Polar **الإنتاج** (وليست sandbox) وبأسعار 29/290، 59/590، 119/1190.
  - [ ] مراجعة صياغة الصفحات القانونية (`5070944`)، وقرار ما إذا يُذكر Polar كـ Merchant of Record.
  - [ ] أي اشتراك أُنشئ قبل `cf169aa` لم يُزامَن من الـ webhooks: التأكد يدويًا من حالته في لوحة الأدمن مقابل Polar.
- [ ] **⚠️ مفاتيح إنتاج في `.env` المحلي:** الملف ما زال يحتوي مفاتيح **الإنتاج** لـ Polar وResend وCloudinary. **الخطة:** (1) نقل dev إلى **Polar sandbox** ومفاتيح تجريبية/اختبار لـ Resend وCloudinary، (2) بعد ذلك **تدوير (rotate) مفاتيح الإنتاج** الثلاثة، لأنها كانت موجودة على جهاز التطوير.
- [ ] **نشر الإنتاج:** زر القائمة في الموبايل يظهر أبيض على أبيض في الإنتاج إلى أن يُنشر `714fcbe` والـ commits التي بعده، ومعها إصلاح padding الموبايل `820b603`.
- [ ] **HawkScan:** لا يعمل لأن `HAWK_API_KEY` غير مضبوط (لم يُشغَّل على أي commit يوم 2026-09-25، ومنها commits القسم 2.1).

### Bugs موثّقة، لم تُصلح بعد
- [x] ~~رسالة التحقق في نموذج إنشاء القضية ناقصة~~: أُصلح في `71326bb`.
- [ ] **تسجيل الدخول بطيء جدًا في dev:** 8–15 ثانية لكل طلب `/api/auth/login`، شبه كلها في application code. يستحق التحقيق (bcrypt cost؟ تأخير متعمد للمحاولات الفاشلة؟ زمن الاتصال بقاعدة البيانات؟).

### تنظيف مقترح
- [ ] **`src/app/dashboard/clients/new/page.tsx`: صفحة غير مستخدمة، مرشّحة للحذف.** لا يوجد أي رابط إليها في الواجهة، فقط في خريطة عناوين `DynamicDocumentTitle.tsx`. نموذج إنشاء الموكل المستخدم فعليًا هو الـ modal في `clients/page.tsx`.
- [ ] **CSS ميت لأزرار FullCalendar** في `globals.css`: القواعد الأضعف التي تشير لـ `--sidebar` تتغلب عليها قواعد `--sidebar-dark`، ويمكن حذفها.
- [ ] **`.dark input { background-color: #061b1c }`** في `globals.css` يتغلب على خلفية حقل البحث في dark، في الـ TopBar والـ drawer معًا. فرق بسيط، وليس خطأ.
