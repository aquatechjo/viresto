# Viresto — دليل النشر على Vercel + Neon
# Viresto — Deployment Guide (Vercel + Neon)

---

## المتطلبات / Prerequisites

- حساب [Vercel](https://vercel.com) (مجاني)
- حساب [Neon](https://neon.tech) (مجاني — PostgreSQL serverless)
- حساب [Cloudinary](https://cloudinary.com) (مجاني — رفع الملفات)
- حساب [Upstash](https://upstash.com) (مجاني — Redis للـ rate limiting)
- مستودع GitHub يحتوي على مشروع Viresto

---

## الخطوة 1 — إعداد Neon (قاعدة البيانات)

1. اذهب إلى https://neon.tech وسجّل الدخول
2. انقر **New Project** → اختر اسماً مثل `Viresto-db`
3. اختر المنطقة الأقرب لمستخدميك (مثلاً `AWS / eu-central-1` للشرق الأوسط)
4. بعد الإنشاء، انقر **Connection string** → انسخ الـ URL الكامل

   يبدو هكذا:
   ```
   postgresql://user:password@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

5. احتفظ بهذا الـ URL — ستحتاجه في متغيرات Vercel

---

## الخطوة 2 — إعداد Upstash (Redis للـ Rate Limiting)

1. اذهب إلى https://upstash.com → **Create Database**
2. اختر نوع **Redis** → اختر منطقة قريبة
3. من صفحة المشروع، انسخ:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

> **مهم:** القيمتان إلزاميتان في الإنتاج. إذا كانت إحداهما مفقودة أو تعذر الوصول إلى Redis، تُغلق المسارات المحمية بشكل آمن وتعيد `503`. العداد المحلي متاح للتطوير فقط.

---

## الخطوة 3 — إعداد Cloudinary (رفع الملفات)

1. اذهب إلى https://cloudinary.com → **Sign Up**
2. من لوحة التحكم، انسخ:
   - **Cloud Name**
   - **API Key**
   - **API Secret**

---

## الخطوة 4 — رفع الكود إلى GitHub

```bash
cd Viresto
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/Viresto.git
git push -u origin main
```

---

## الخطوة 5 — نشر على Vercel

1. اذهب إلى https://vercel.com → **Add New Project**
2. اختر مستودع `Viresto` من GitHub
3. Vercel يكتشف Next.js تلقائياً — لا تغيير في الإعدادات
4. أضف **Environment Variables** (انقر على Environment Variables):

| المفتاح | القيمة |
|---------|--------|
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_APP_URL` | رابط الموقع على Vercel أو الدومين الرسمي |
| `PUBLIC_REGISTER_ENABLED` | `false` في الإنتاج |
| `DATABASE_URL` | رابط Neon pooled connection |
| `DIRECT_URL` | رابط Neon direct connection للمigrations |
| `JWT_SECRET` | نص عشوائي طويل |
| `PASSWORD_RESET_SECRET` | سر عشوائي مستقل بطول 32 حرفًا على الأقل |
| `VERIFICATION_SECRET` | سر عشوائي مستقل بطول 32 حرفًا على الأقل |
| `ENCRYPTION_KEY` | مفتاح base64 بطول 32 bytes |
| `ENCRYPTION_KEY_ID` | معرف ثابت للمفتاح الحالي مثل `key-2026-01` |
| `ENCRYPTION_PREVIOUS_KEYS` | فارغ عادة؛ يستخدم فقط أثناء تدوير المفاتيح القديمة |
| `SEARCH_HASH_SECRET` | نص عشوائي طويل وثابت |
| `CLOUDINARY_CLOUD_NAME` | من Cloudinary |
| `CLOUDINARY_API_KEY` | من Cloudinary |
| `CLOUDINARY_API_SECRET` | من Cloudinary |
| `UPSTASH_REDIS_REST_URL` | من Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | من Upstash |
| `RESEND_API_KEY` | مفتاح Resend لإرسال التحقق والاسترجاع |
| `EMAIL_FROM` | عنوان المرسل الموثق في Resend |
| `CRON_SECRET` | سر عشوائي مستقل بطول 32 حرفًا على الأقل |
| `APP_URL` | `https://www.virestojo.com` |
| `ALLOWED_SERVER_ACTION_ORIGINS` | `virestojo.com,www.virestojo.com` بدون `https://` |
| `PUBLIC_REGISTER_ENABLED` | `true` أو `false` ويجب أن يطابق متغير الواجهة |
| `NEXT_PUBLIC_REGISTER_ENABLED` | نفس قيمة `PUBLIC_REGISTER_ENABLED` |
| `OPENAI_API_KEY` | اختياري — اتركه فارغًا إذا لن تستخدم AI |

**لتوليد JWT_SECRET عشوائي:**
```bash
openssl rand -base64 64
# أو في Node.js:
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```
````md
**لتوليد ENCRYPTION_KEY:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"


5. انقر **Deploy** → انتظر دقيقة أو دقيقتين

### فحص البيئة قبل النشر

يشغّل `npm run build` فحص البيئة تلقائيًا. ويمكن تشغيله منفصلًا:

```bash
npm run env:check
```

في Production يفشل البناء إذا كان سر أو اتصال أساسي ناقصًا، أو إذا كانت رايات التسجيل غير متطابقة. الفحص لا يطبع قيم الأسرار.

### تدوير مفتاح تشفير بيانات الموكلين

لا تحذف المفتاح القديم مباشرة. اجعل المفتاح الجديد هو `ENCRYPTION_KEY` وغيّر معرفه في `ENCRYPTION_KEY_ID`، ثم احتفظ بالمفتاح السابق مؤقتًا بهذا الشكل:

```env
ENCRYPTION_KEY="NEW_BASE64_KEY"
ENCRYPTION_KEY_ID="key-2026-02"
ENCRYPTION_PREVIOUS_KEYS="key-2026-01=OLD_BASE64_KEY"
```

البيانات الجديدة تستخدم المفتاح الجديد، وتبقى البيانات القديمة قابلة للقراءة. لا تغيّر `SEARCH_HASH_SECRET` من دون عملية backfill مخصصة لقيم البحث.

---

## الخطوة 6 — تشغيل Migration على Neon

بعد النشر، شغّل الـ migration مرة واحدة عبر جهازك المحلي:

```bash
# في مجلد المشروع على جهازك
DATABASE_URL="your-neon-url" npx prisma migrate deploy
DATABASE_URL="your-neon-url" npx ts-node prisma/seed.ts
```

> أو استخدم **Neon SQL Editor** في لوحة التحكم لتشغيل الـ migration يدوياً.

---

## الخطوة 7 — تخصيص النطاق (اختياري)

1. في Vercel → مشروعك → **Settings → Domains**
2. أضف نطاقك الخاص مثل `Viresto.yourdomain.com`
3. أضف CNAME record في DNS يشير إلى `cname.vercel-dns.com`

---

## ملاحظات مهمة بعد النشر

### 🔒 الأمان
- غيّر كلمة مرور الـ seed فوراً: `lawyer@example.com / Lawyer@123456`
- تأكد أن `NODE_ENV=production` مضبوطة (تفعّل الـ secure cookie)
- لا تضع قيم `.env` في الكود أو GitHub

### 🚀 الأداء
- Neon يدعم **connection pooling** — استخدم `?pgbouncer=true` في الـ URL للإنتاج
- Vercel Edge Network يوزع الطلبات تلقائياً

### 📦 تحديث المشروع
```bash
git add .
git commit -m "your changes"
git push
# Vercel يعيد النشر تلقائياً
```

---

## ملخص المتغيرات البيئية

```env
# قاعدة البيانات
DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"

# المصادقة
JWT_SECRET="your-very-long-random-secret-here"

# Cloudinary (رفع الملفات)
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"

# Upstash Redis (rate limiting — إلزامي في الإنتاج)
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your_token"

# App
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://your-domain.com"
PUBLIC_REGISTER_ENABLED="false"
ALLOWED_SERVER_ACTION_ORIGINS="your-domain.com,www.your-domain.com"
```

---

## استكشاف الأخطاء / Troubleshooting

| المشكلة | الحل |
|---------|------|
| `PrismaClientInitializationError` | تحقق من DATABASE_URL في Vercel |
| الصفحات لا تُحمَّل بعد النشر | شغّل `prisma migrate deploy` على Neon |
| رسالة "غير مصرح" عند تسجيل الدخول | تحقق من JWT_SECRET وتأكد أنها نفسها في كل deploy |
| الملفات لا ترفع | تحقق من قيم Cloudinary الثلاث |
| المسارات المحمية تعيد `503` | تحقق من وجود متغيري Upstash في بيئة Production ومن إمكانية الوصول إلى Redis |
| Rate limit يطرد المستخدمين | راجع حدود المحاولات وحالة Upstash قبل تعديل القيم في `src/lib/rate-limit.ts` |
