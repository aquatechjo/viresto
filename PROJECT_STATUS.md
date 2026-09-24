# Viresto — حالة المشروع (PROJECT_STATUS)

> آخر تحديث: 2026-09-24
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
1. **Products:** 6 منتجات مُنشأة مسبقًا على Polar (كل خطة × دورة فوترة شهري/سنوي)، ومربوطة بـ env vars.
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

### 🟡 معلّق (من تقرير الـ responsiveness الأصلي، لم يُنفّذ بعد)
- [ ] **الجداول العريضة** تحتاج تمريرًا أفقيًا منظمًا أو عرض بطاقات على الموبايل:
  - `dashboard/finance/payments`
  - `dashboard/finance/invoices`
  - `dashboard/cases`
  - `dashboard/clients`
- [ ] **تقويم المواعيد (FullCalendar)** في `dashboard/appointments`: الـ toolbar والعرض غير مناسبين للشاشات الصغيرة. يحتاج view افتراضي مختلف على الموبايل (list/day) وtoolbar مضغوط.
- [ ] **أزرار أصغر من معيار اللمس (44×44px)** في `login` و`register` ومكوّن `Modal` (أزرار الإغلاق/الإجراءات).
- [ ] **مشكلة RTL في `src/components/pricing/PricingSection.tsx`**: اتجاه/محاذاة غير صحيحة في RTL.

---

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
- **آخر commit للكود/الإعداد:** `b506091` — `test: add create-case E2E spec and guarded seed:e2e script` (2026-09-24)، ويليه commit تحديث هذا الملف.
- **حالة الـ push:** `main` = `origin/main`. **كل الـ commits مرفوعة** (آخر دفعة: `71326bb`، `201cf4e`، `b506091`، ثم commit الـ docs هذا).
- **معلّق محليًا (غير ملتزم، عن قصد):**
  - `next-env.d.ts`: عدّله dev server تلقائيًا، لا يُلتزم به.
  - `.claude/` (untracked): فيه `launch.json` لخادم التطوير.

**تسلسل الـ commits (الأقدم أولًا):**
`2d5f48a` Polar ← `5fd940d` تنظيف CliQ ← `689eadb` اختبارات الدفع ← `6dd80da` ضغط الشعارات ← `3e98af1` auth cache ← `ee186a9` loading/error boundaries ← `94cb033` viewport + hamburger ← `f507eaf` ألوان Phase 1 ← `714fcbe` إصلاح Sidebar ← `4c3e1f9` `--accent-*` ← `bd4298d` hex → tokens ← `7654314` PROJECT_STATUS.md ← `820b603` إصلاح padding الموبايل ← `15196f2` بحث الـ drawer ← `6cacbc2` حذف GlobalSearch ← `d33fe07` مهلة 30 دقيقة + تحذير ← `9d0179b` تجديد الجلسة بالنشاط فقط ← `e6231db` حد 12 ساعة ← `1a451ad` المسودات ← `2b4f9e0` next آمن ← `8b6b388` رسالة سبب الخروج ← `1a3da05` تحديث الحالة ← `3609528` CLAUDE.md (قاعدة مزامنة الحالة) ← `71326bb` رسالة تحقق نموذج القضية ← `201cf4e` fail-closed لمهلة Upstash في الإنتاج ← `b506091` اختبار E2E لإنشاء القضية + `seed:e2e` المحمي

---

## 9. ملاحظات بيئية مهمة

### الـ Hooks المكسورة (Security Guidance + Pixeltable) — ✅ أُصلح (2026-09-24)، ويتطلب إعادة تشغيل Claude Desktop
- **الأعراض:** إشعار "Push/Commit security review found issues" بعد كل commit/push، و"hook blocking error" بعد كل Write/Edit. **إنذار كاذب**: لم تُجرَ أي مراجعة أمنية فعلية أصلًا، والكتابة والـ commit ينجحان.
- **الـ hooks المتأثرة:**
  - `security-guidance` v2.0.8 (plugin_01YBNfaNwQztYsnUydt8m47G) ← `security_reminder_hook.py`
  - `pixeltable` v2.11.2 (plugin_01HuktqZUKz58qgxUm1mfuh6) ← `validate_antipatterns.py`
- **السبب الجذري (تم التحقق منه 2026-09-24):** الملفات **موجودة** على القرص، لكن Python الوحيد على الجهاز هو نسخة **Microsoft Store** (`WindowsAppsPythonSoftwareFoundation.Python.3.13_…`). هذه النسخة تعمل داخل sandbox (MSIX)، فلا ترى ملفات `AppDataRoamingClaude…`. `os.path.exists` يعيد `False` لملف موجود فعلًا.
- **الإصلاح المُطبّق:** ثُبّت Python 3.13.15 من python.org عبر `winget install -e --id Python.Python.3.13 --source winget --scope user`، ومساره في user PATH قبل `WindowsApps`. أُضيفت نسخة `python.exe` باسم `python3.13.exe` في `%LOCALAPPDATA%ProgramsPythonPython313`، لأن `sg-python.sh` يجرّب `python3.13` أولًا، والاسم الوحيد بهذا الشكل كان الـ Store alias. تم التحقق: كلا الـ hookين يعملان (exit 0). **للتراجع:** احذف `python3.13.exe` من ذلك المجلد. **حل بديل أنظف:** عطّل aliases الـ python في Windows Settings ← Apps ← Advanced app settings ← App execution aliases.

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

### قيد التنفيذ
- لا شيء.

### التالي (مقترح)
1. **تشغيل `npm run test:e2e`** والتأكد من نجاح `login.spec.ts` و`create-case.spec.ts` بعد وجود حساب الاختبار. لم يُشغَّلا بعد.
2. **فصل dev عن مفاتيح الإنتاج** (انظر "بانتظارك").
3. **بنود الموبايل المعلّقة** في القسم 5: الجداول العريضة، التقويم، أزرار اللمس، و RTL في PricingSection.
4. **تنظيف:** حذف `clients/new` وحذف CSS التقويم الميت.

### ⏳ بانتظارك
- [ ] **⚠️ مفاتيح إنتاج في `.env` المحلي:** الملف ما زال يحتوي مفاتيح **الإنتاج** لـ Polar وResend وCloudinary. **الخطة:** (1) نقل dev إلى **Polar sandbox** ومفاتيح تجريبية/اختبار لـ Resend وCloudinary، (2) بعد ذلك **تدوير (rotate) مفاتيح الإنتاج** الثلاثة، لأنها كانت موجودة على جهاز التطوير.
- [ ] **نشر الإنتاج:** زر القائمة في الموبايل يظهر أبيض على أبيض في الإنتاج إلى أن يُنشر `714fcbe` والـ commits التي بعده، ومعها إصلاح padding الموبايل `820b603`.
- [ ] **HawkScan:** لا يعمل لأن `HAWK_API_KEY` غير مضبوط.

### Bugs موثّقة، لم تُصلح بعد
- [x] ~~رسالة التحقق في نموذج إنشاء القضية ناقصة~~: أُصلح في `71326bb`.
- [ ] **تسجيل الدخول بطيء جدًا في dev:** 8–15 ثانية لكل طلب `/api/auth/login`، شبه كلها في application code. يستحق التحقيق (bcrypt cost؟ تأخير متعمد للمحاولات الفاشلة؟ زمن الاتصال بقاعدة البيانات؟).

### تنظيف مقترح
- [ ] **`src/app/dashboard/clients/new/page.tsx`: صفحة غير مستخدمة، مرشّحة للحذف.** لا يوجد أي رابط إليها في الواجهة، فقط في خريطة عناوين `DynamicDocumentTitle.tsx`. نموذج إنشاء الموكل المستخدم فعليًا هو الـ modal في `clients/page.tsx`.
- [ ] **CSS ميت لأزرار FullCalendar** في `globals.css`: القواعد الأضعف التي تشير لـ `--sidebar` تتغلب عليها قواعد `--sidebar-dark`، ويمكن حذفها.
- [ ] **`.dark input { background-color: #061b1c }`** في `globals.css` يتغلب على خلفية حقل البحث في dark، في الـ TopBar والـ drawer معًا. فرق بسيط، وليس خطأ.
