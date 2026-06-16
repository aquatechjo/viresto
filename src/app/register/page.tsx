"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import FormField from "@/components/ui/FormField";

export default function RegisterPage() {
  const router = useRouter();
  const publicRegisterEnabled =
    process.env.NEXT_PUBLIC_REGISTER_ENABLED === "true";
  const [form, setForm] = useState({
    tenantName: "",
    name: "",
    email: "",
    phone: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function update(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(
          data?.data?.message ??
            "تم إنشاء المكتب. يرجى تأكيد البريد الإلكتروني.",
        );

        const verifyEmail = data?.data?.email || form.email;

        router.push(`/verify-email?email=${encodeURIComponent(verifyEmail)}`);
      } else {
        toast.error(data.message ?? "حدث خطأ");
      }
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  }

  if (!publicRegisterEnabled) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: "var(--bg)" }}
      >
        <div className="card w-full max-w-sm p-7 text-center">
          <h1
            className="text-xl font-black mb-3"
            style={{ color: "var(--text)" }}
          >
            التسجيل غير متاح حالياً
          </h1>

          <p className="text-sm leading-7" style={{ color: "var(--text-3)" }}>
            إنشاء الحسابات الجديدة يتم حالياً من خلال إدارة Viresto فقط.
          </p>

          <Link href="/login" className="btn btn-primary mt-6 w-full">
            العودة إلى تسجيل الدخول
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--bg)" }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <p
            className="font-black text-2xl"
            style={{ color: "var(--sidebar)" }}
          >
            نظام المحامي
          </p>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
            أنشئ مكتبك القانوني الآن
          </p>
        </div>

        <div className="card p-7">
          <h1
            className="text-xl font-black mb-5"
            style={{ color: "var(--text)" }}
          >
            تسجيل مكتب جديد
          </h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="اسم المكتب القانوني" required>
              <input
                name="organization"
                autoComplete="organization"
                value={form.tenantName}
                onChange={update("tenantName")}
                className="input"
                placeholder="مكتب المنصوري للمحاماة"
              />
            </FormField>
            <FormField label="اسمك الكامل" required>
              <input
                name="name"
                autoComplete="name"
                value={form.name}
                onChange={update("name")}
                className="input"
                placeholder="أحمد المنصوري"
              />
            </FormField>
            <FormField label="البريد الإلكتروني" required>
              <input
                dir="ltr"
                type="email"
                name="email"
                autoComplete="email"
                value={form.email}
                onChange={update("email")}
                className="input text-left"
                placeholder="ahmed@law.jo"
              />
            </FormField>

            <FormField label="رقم الهاتف" required>
              <input
                dir="ltr"
                type="tel"
                name="phone"
                autoComplete="tel"
                inputMode="tel"
                value={form.phone}
                onChange={update("phone")}
                className="input text-left"
                placeholder="07XXXXXXXX"
              />
            </FormField>
            <FormField label="كلمة المرور" required>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="new-password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={update("password")}
                  className="input pl-14"
                  placeholder="مثال: Viresto@123"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-xl px-2 py-1 text-xs font-bold transition hover:bg-white/10"
                  style={{ color: "var(--text-3)" }}
                  aria-label={
                    showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
                  }
                >
                  {showPassword ? "إخفاء" : "إظهار"}
                </button>
              </div>
              <p
                className="mt-2 text-xs leading-6"
                style={{ color: "var(--text-3)" }}
              >
                يجب أن تحتوي كلمة المرور على حرف كبير، حرف صغير، رقم، ورمز خاص.
              </p>
            </FormField>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-2.5 mt-1"
            >
              {loading ? (
                <span className="spinner spinner-sm" />
              ) : (
                "إنشاء المكتب"
              )}
            </button>
          </form>
          <p
            className="text-center text-sm mt-4"
            style={{ color: "var(--text-3)" }}
          >
            لديك حساب؟{" "}
            <Link
              href="/login"
              className="font-bold"
              style={{ color: "var(--sidebar)" }}
            >
              سجّل دخولك
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
