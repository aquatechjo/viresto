"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { motion } from "framer-motion";
import Image from "next/image";
import FormField from "@/components/ui/FormField";

const floatingCards = [
  {
    icon: "⚖️",
    title: "قضية جديدة",
    desc: "تم تحديث حالة القضية",
    delay: 0,
  },
  {
    icon: "🧾",
    title: "فاتورة مدفوعة",
    desc: "تم تسجيل دفعة جديدة",
    delay: 0.7,
  },
  {
    icon: "📅",
    title: "موعد قريب",
    desc: "جلسة غدًا الساعة 10:00",
    delay: 1.2,
  },
];

const features = [
  {
    icon: "⚖️",
    title: "إدارة القضايا",
    desc: "تابع القضايا، الحالات، والملاحظات من لوحة واحدة.",
  },
  {
    icon: "👥",
    title: "ملفات الموكلين",
    desc: "سجلات منظمة لكل موكل مع القضايا والمستندات.",
  },
  {
    icon: "🧾",
    title: "الفواتير والتقارير",
    desc: "تحصيل، فواتير، تقارير مالية، ومؤشرات واضحة.",
  },
];

const ambientIcons = [
  { icon: "⚖️", left: "7%", top: "14%", delay: 0 },
  { icon: "📜", left: "18%", top: "44%", delay: 0.4 },
  { icon: "🧾", left: "10%", top: "76%", delay: 0.8 },
  { icon: "📅", left: "48%", top: "82%", delay: 1.2 },
  { icon: "🔐", left: "72%", top: "24%", delay: 1.6 },
  { icon: "💼", left: "88%", top: "72%", delay: 2 },
  { icon: "📁", left: "38%", top: "22%", delay: 2.4 },
  { icon: "✍️", left: "62%", top: "58%", delay: 2.8 },

  { icon: "🏛️", left: "30%", top: "12%", delay: 3.2 },
  { icon: "📌", left: "4%", top: "38%", delay: 3.6 },
  { icon: "🕒", left: "24%", top: "68%", delay: 4 },
  { icon: "📊", left: "36%", top: "64%", delay: 4.4 },
  { icon: "🖋️", left: "54%", top: "16%", delay: 4.8 },
  { icon: "📎", left: "58%", top: "74%", delay: 5.2 },
  { icon: "✅", left: "80%", top: "46%", delay: 5.6 },
  { icon: "🗂️", left: "92%", top: "34%", delay: 6 },
  { icon: "🔎", left: "68%", top: "84%", delay: 6.4 },
  { icon: "📑", left: "44%", top: "42%", delay: 6.8 },
];

export default function LoginPage() {
  const router = useRouter();
  const publicRegisterEnabled =
    process.env.NEXT_PUBLIC_REGISTER_ENABLED === "true";

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const hasToken = document.cookie.includes("ld_token");

    if (hasToken) {
      router.push("/dashboard");
    }
  }, [router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const err: Record<string, string> = {};

    if (!form.email) err.email = "البريد الإلكتروني مطلوب";
    if (!form.password) err.password = "كلمة المرور مطلوبة";

    if (Object.keys(err).length) {
      setErrors(err);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));

      if (data.success) {
        toast.success("مرحباً بك في Viresto!");
        router.push("/dashboard");
        return;
      }
      const code = data?.details?.code || data?.data?.code || data?.code;

      const next = data?.details?.next || data?.data?.next || data?.next;

      const verifyEmail =
        data?.details?.email || data?.data?.email || data?.email || form.email;

      if (code === "EMAIL_NOT_VERIFIED" || next === "EMAIL_VERIFICATION") {
        toast.error(data?.message || "يرجى تأكيد البريد الإلكتروني أولاً");
        router.push(`/verify-email?email=${encodeURIComponent(verifyEmail)}`);
        return;
      }

      toast.error(data?.message ?? "حدث خطأ");
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden"
      dir="rtl"
      style={{
        background:
          "radial-gradient(circle at 15% 20%, rgba(245,200,66,.18), transparent 28%), radial-gradient(circle at 85% 15%, rgba(255,255,255,.12), transparent 26%), linear-gradient(135deg, #10261f 0%, #1f4639 48%, #071713 100%)",
      }}
    >
      {/* Animated background */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -right-24 top-20 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "rgba(245, 200, 66, 0.18)" }}
          animate={{
            x: [0, -40, 20, 0],
            y: [0, 30, -20, 0],
            scale: [1, 1.12, 0.96, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <motion.div
          className="absolute bottom-10 left-10 h-96 w-96 rounded-full blur-3xl"
          style={{ background: "rgba(255,255,255,0.10)" }}
          animate={{
            x: [0, 35, -20, 0],
            y: [0, -35, 20, 0],
            scale: [1, 0.92, 1.08, 1],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />

        {ambientIcons.map((item, index) => (
          <motion.div
            key={`${item.icon}-${index}`}
            className="pointer-events-none absolute hidden h-12 w-12 items-center justify-center rounded-2xl text-2xl backdrop-blur-xl lg:flex"
            style={{
              left: item.left,
              top: item.top,
              background: "rgba(255,255,255,.08)",
              border: "1px solid rgba(255,255,255,.12)",
              boxShadow: "0 18px 45px rgba(0,0,0,.12)",
              zIndex: 2,
            }}
            initial={{
              opacity: 0,
              scale: 0.7,
              rotate: -10,
            }}
            animate={{
              opacity: [0.25, 0.6, 0.25],
              y: [0, -18, 0],
              x: [0, index % 2 === 0 ? 10 : -10, 0],
              rotate: [-4, 6, -4],
              scale: [1, 1.08, 1],
            }}
            transition={{
              duration: 5 + index * 0.4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: item.delay,
            }}
          >
            {item.icon}
          </motion.div>
        ))}
      </div>

      <div className="relative z-20 grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_.95fr]">
        {/* Brand / motion side */}
        <section className="relative hidden overflow-hidden p-10 lg:flex lg:flex-col lg:justify-between">
          <motion.div
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="flex items-center gap-3">
              <div
                className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-3xl bg-white p-2"
                style={{
                  boxShadow: "0 18px 50px rgba(0,0,0,.18)",
                }}
              >
                <Image
                  src="/logo.png"
                  alt="Viresto Logo"
                  width={44}
                  height={44}
                  className="h-full w-full object-contain"
                  priority
                />
              </div>

              <div>
                <p className="text-3xl font-black text-white">Viresto</p>
                <p className="mt-1 text-sm font-semibold text-white/55">
                  نظام إدارة مكاتب المحاماة
                </p>
              </div>
            </div>
          </motion.div>
          <div className="relative flex flex-1 items-center">
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.15 }}
              className="relative z-20 max-w-xl"
            >
              <h1 className="text-5xl font-black leading-[1.25] text-white">
                أدر مكتبك القانوني
                <br />
                بثقة ووضوح.
              </h1>

              <p className="mt-5 max-w-lg text-base font-semibold leading-8 text-white/65">
                منصة واحدة لتنظيم القضايا، الموكلين، المواعيد، المستندات،
                الفواتير، والتقارير المالية بطريقة احترافية وسريعة.
              </p>

              <div className="mt-8 grid max-w-lg gap-3">
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 + index * 0.12 }}
                    className="flex items-start gap-3 rounded-3xl border p-4 backdrop-blur-xl"
                    style={{
                      background: "rgba(255,255,255,.10)",
                      borderColor: "rgba(255,255,255,.16)",
                    }}
                  >
                    <span className="text-2xl">{feature.icon}</span>

                    <div>
                      <p className="text-sm font-black text-white">
                        {feature.title}
                      </p>
                      <p className="mt-1 text-xs font-semibold leading-6 text-white/55">
                        {feature.desc}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {floatingCards.map((card, index) => (
              <motion.div
                key={card.title}
                className="absolute hidden w-48 rounded-3xl border p-4 shadow-2xl backdrop-blur-xl 2xl:block"
                style={{
                  background: "rgba(255,255,255,.12)",
                  borderColor: "rgba(255,255,255,.16)",
                  left: index === 0 ? "-2%" : index === 1 ? "2%" : "-4%",
                  top: index === 0 ? "24%" : index === 1 ? "52%" : "78%",
                  zIndex: 8,
                }}
                initial={{ opacity: 0, y: 25, scale: 0.96 }}
                animate={{
                  opacity: 1,
                  y: [0, -12, 0],
                  scale: [1, 1.02, 1],
                }}
                transition={{
                  opacity: { duration: 0.6, delay: 0.45 + card.delay },
                  y: {
                    duration: 4 + index,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: card.delay,
                  },
                  scale: {
                    duration: 4 + index,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: card.delay,
                  },
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{card.icon}</span>

                  <div>
                    <p className="text-sm font-black text-white">
                      {card.title}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-white/55">
                      {card.desc}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-xs font-semibold text-white/35"
          >
            © {new Date().getFullYear()} Viresto. جميع الحقوق محفوظة.
          </motion.p>
        </section>

        {/* Login side */}
        <section className="flex items-center justify-center p-5 sm:p-8">
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
            className="w-full max-w-md"
          >
            {/* Mobile logo */}
            <div className="mb-8 text-center lg:hidden">
              <motion.div
                initial={{ rotate: -8, scale: 0.9 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl bg-white p-2"
              >
                <Image
                  src="/logo.png"
                  alt="Viresto Logo"
                  width={52}
                  height={52}
                  className="h-full w-full object-contain"
                  priority
                />
              </motion.div>

              <p className="text-3xl font-black text-white">Viresto</p>
              <p className="mt-1 text-sm font-semibold text-white/55">
                نظام إدارة مكاتب المحاماة
              </p>
            </div>

            <div
              className="relative overflow-hidden rounded-[32px] border p-1 shadow-2xl backdrop-blur-2xl"
              style={{
                background: "rgba(255,255,255,.14)",
                borderColor: "rgba(255,255,255,.22)",
              }}
            >
              <div
                className="absolute -right-12 -top-12 h-32 w-32 rounded-full blur-2xl"
                style={{ background: "rgba(245,200,66,.24)" }}
              />

              <div className="relative rounded-[28px] bg-white/90 p-6 text-slate-900 shadow-inner sm:p-7 dark:bg-[#10291d]/95 dark:text-emerald-50">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <div className="mb-4 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800 dark:bg-[#1f4d35] dark:text-emerald-50">
                    مرحبًا بعودتك
                  </div>

                  <h2 className="text-2xl font-black text-slate-900 dark:text-emerald-50">
                    تسجيل الدخول
                  </h2>

                  <p className="mt-2 text-sm font-medium text-slate-600 dark:text-emerald-100/75">
                    أدخل بياناتك للوصول إلى لوحة التحكم وإدارة مكتبك.
                  </p>
                </motion.div>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                  >
                    <FormField
                      label="البريد الإلكتروني"
                      required
                      error={errors.email}
                    >
                      <input
                        type="email"
                        value={form.email}
                        autoComplete="email"
                        onChange={(event) => {
                          setForm((previous) => ({
                            ...previous,
                            email: event.target.value,
                          }));
                          setErrors((previous) => ({
                            ...previous,
                            email: "",
                          }));
                        }}
                        className="input"
                        placeholder="lawyer@example.com"
                      />
                    </FormField>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                  >
                    <FormField
                      label="كلمة المرور"
                      required
                      error={errors.password}
                    >
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={form.password}
                          autoComplete="current-password"
                          onChange={(event) => {
                            setForm((previous) => ({
                              ...previous,
                              password: event.target.value,
                            }));
                            setErrors((previous) => ({
                              ...previous,
                              password: "",
                            }));
                          }}
                          className="input pl-16"
                          placeholder="••••••••"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowPassword((previous) => !previous)
                          }
                          className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-xl bg-white/80 px-2 py-1 text-xs font-black !text-[#17352b] transition hover:bg-white dark:bg-white/80 dark:!text-[#17352b]"
                        >
                          {showPassword ? "إخفاء" : "إظهار"}
                        </button>
                      </div>
                    </FormField>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="flex justify-end"
                  >
                    <Link
                      href="/forgot-password"
                      className="text-sm font-black text-[#1f4639] transition hover:underline dark:text-emerald-300"
                    >
                      نسيت كلمة المرور؟
                    </Link>
                  </motion.div>

                  <motion.button
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    whileHover={{ scale: loading ? 1 : 1.015 }}
                    whileTap={{ scale: loading ? 1 : 0.985 }}
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary w-full py-3 text-base"
                    style={{
                      boxShadow: "0 18px 35px rgba(31,70,57,.28)",
                    }}
                  >
                    {loading ? <span className="spinner spinner-sm" /> : "دخول"}
                  </motion.button>
                </form>

                {publicRegisterEnabled && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.55 }}
                    className="mt-5 text-center text-sm font-semibold text-slate-600 dark:text-emerald-100/75"
                  >
                    ليس لديك حساب؟{" "}
                    <Link
                      href="/register"
                      className="font-black text-[#1f4639] hover:underline dark:text-emerald-300"
                    >
                      سجّل مكتبك
                    </Link>
                  </motion.p>
                )}
              </div>
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
