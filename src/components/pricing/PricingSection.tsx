import { PLANS, PLAN_ADDONS, formatTokens, getDisplayPrice } from "@/config/plans";

export default function PricingSection() {
  return (
    <section dir="rtl" className="w-full bg-slate-950 py-20 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <p className="mb-3 text-sm font-semibold text-emerald-400">
            خطط Viresto
          </p>

          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            اختر الخطة المناسبة لمكتبك
          </h2>

          <p className="mt-4 text-base leading-8 text-slate-300">
            ابدأ بخطة تناسب حجم مكتبك، وقم بالترقية لاحقًا عند الحاجة.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const displayPrice = getDisplayPrice(plan);
            const hasLaunchPrice = Boolean(plan.launchPriceJod);

            return (
              <article
                key={plan.code}
                className={[
                  "relative rounded-3xl border p-6 shadow-2xl transition",
                  plan.highlighted
                    ? "border-emerald-400 bg-slate-900 shadow-emerald-950/50"
                    : "border-white/10 bg-slate-900/70",
                ].join(" ")}
              >
                {plan.badge && (
                  <div className="absolute left-6 top-6 rounded-full bg-emerald-500/15 px-4 py-1 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="text-2xl font-bold">{plan.name}</h3>
                  <p className="mt-2 text-sm text-slate-300">{plan.subtitle}</p>
                </div>

                <div className="mb-6">
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-black text-emerald-400">
                      {displayPrice}
                    </span>
                    <span className="pb-2 text-sm text-slate-300">
                      JOD / شهر
                    </span>
                  </div>

                  {hasLaunchPrice && (
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-300">
                        سعر الإطلاق
                      </span>
                      <span className="text-slate-400 line-through">
                        {plan.priceJod} JOD
                      </span>
                    </div>
                  )}
                </div>

                <p className="min-h-12 border-b border-white/10 pb-6 text-sm leading-7 text-slate-300">
                  {plan.description}
                </p>

                <div className="mt-6 grid gap-3 text-sm">
                  <LimitRow label="المستخدمون" value={plan.limits.users} />
                  <LimitRow label="الموكلون" value={plan.limits.clients} />
                  <LimitRow label="القضايا" value={plan.limits.cases} />
                  <LimitRow label="التخزين" value={`${plan.limits.storageGb}GB`} />
                  <LimitRow
                    label="AI"
                    value={
                      plan.limits.aiEnabled
                        ? `${formatTokens(plan.limits.aiMonthlyTokens)} / شهر`
                        : "لا"
                    }
                  />
                </div>

                <div className="mt-8">
                  <button
                    type="button"
                    className={[
                      "w-full rounded-xl px-5 py-3 text-sm font-bold transition",
                      plan.highlighted
                        ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                        : "border border-white/15 text-white hover:border-emerald-400 hover:text-emerald-300",
                    ].join(" ")}
                  >
                    ابدأ الآن
                  </button>
                </div>

                <ul className="mt-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature.label}
                      className="flex items-start justify-between gap-4 text-sm"
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={[
                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs",
                            feature.included
                              ? "bg-emerald-400/15 text-emerald-300"
                              : "bg-slate-800 text-slate-500",
                          ].join(" ")}
                        >
                          {feature.included ? "✓" : "×"}
                        </span>

                        <span
                          className={
                            feature.included ? "text-slate-100" : "text-slate-500"
                          }
                        >
                          {feature.label}
                        </span>
                      </div>

                      {feature.value && (
                        <span className="shrink-0 text-xs text-slate-400">
                          {feature.value}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <div className="mt-10 rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <div className="mb-6">
            <h3 className="text-xl font-bold">إضافات مرنة</h3>
            <p className="mt-2 text-sm text-slate-300">
              زد من قدرات خطتك حسب احتياج مكتبك.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {PLAN_ADDONS.map((addon) => (
              <div
                key={addon.code}
                className="rounded-2xl border border-white/10 bg-slate-950/60 p-5"
              >
                <p className="font-semibold">{addon.name}</p>
                <p className="mt-3 text-2xl font-black text-emerald-400">
                  {addon.priceJod}{" "}
                  <span className="text-sm font-medium text-slate-300">
                    JOD / {addon.unit}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-4 text-sm text-slate-300 md:grid-cols-4">
          <TrustItem title="بياناتك آمنة" text="تشفير وحماية على مستوى عالٍ." />
          <TrustItem title="ترقية أو خفض الخطة" text="يمكنك التغيير عند الحاجة." />
          <TrustItem title="إلغاء في أي وقت" text="بدون التزام طويل." />
          <TrustItem title="تحديثات مستمرة" text="نطور المنصة باستمرار." />
        </div>
      </div>
    </section>
  );
}

function LimitRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

function TrustItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
      <p className="font-bold text-white">{title}</p>
      <p className="mt-2 leading-6">{text}</p>
    </div>
  );
}