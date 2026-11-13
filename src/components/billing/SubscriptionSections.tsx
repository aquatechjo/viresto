"use client";

// The sections of the subscriptions page (src/app/dashboard/billing).
// Colours: theme tokens only (globals.css / src/lib/theme/tokens.ts).
// Motion: this page is the one scoped exception to the app's 0.15s
// entrance budget; its timings are in ./billing-motion.ts (entrances
// 0.45s, 80ms apart; transform and opacity only, no overshoot). Nothing
// moves with prefers-reduced-motion: every state is shown at once.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CreditCard,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { PLANS, formatYearlySavings, type PlanCode } from "@/config/plans";
import {
  BILLING_ENTRANCE,
  CONFETTI_PIECES,
  COUNT_DURATION,
  EASE_OUT,
  TOGGLE_SPRING,
  formatCount,
  revealOnScroll,
  splitPrice,
} from "./billing-motion";

/** Counts from `from` to `to` once `start` is true (instant with reduced motion). */
function useCount(from: number, to: number, start: boolean, options: { delay?: number; duration?: number } = {}) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? to : from);
  const { delay = 0, duration = COUNT_DURATION } = options;
  useEffect(() => {
    if (reduce) {
      setValue(to);
      return;
    }
    if (!start) return;
    const controls = animate(from, to, { duration, delay, ease: EASE_OUT, onUpdate: setValue });
    return () => controls.stop();
  }, [reduce, start, from, to, delay, duration]);
  return value;
}

// ---------------------------------------------------------------------------
// Copy

export function subscriptionCopy(isArabic: boolean) {
  return isArabic
    ? {
        locale: "ar" as const,
        trialTitle: "أنت في الفترة التجريبية",
        trialDaysLeft: (n: number) =>
          n === 0 ? "تنتهي اليوم" : n === 1 ? "يوم واحد متبقٍ" : n === 2 ? "يومان متبقيان" : n <= 10 ? `${n} أيام متبقية` : `${n} يومًا متبقيًا`,
        trialBody: "كل الميزات متاحة على حدود خطة Pro. اختر خطتك قبل انتهاء التجربة لتستمر بلا انقطاع.",
        trialOf: (total: number) => `من ${total} يومًا`,
        choosePlan: "اختر خطتك",
        monthly: "شهري",
        yearly: "سنوي",
        perMonth: "/ شهريًا",
        perYear: "/ سنويًا",
        recommended: "الأكثر طلباً",
        currentPlan: "خطتك الحالية",
        subscribe: "اشترك الآن",
        switchPlan: "التبديل إلى هذه الخطة",
        switchCycle: "تغيير دورة الفوترة",
        processing: "جارٍ التحضير…",
        plansTitle: "خطط الاشتراك",
        plansSubtitle: "أسعار واضحة بالدولار. يمكنك الترقية أو الإلغاء في أي وقت.",
        compareTitle: "مقارنة الخطط",
        feature: "الميزة",
        faqTitle: "أسئلة شائعة",
        trust: [
          { icon: "shield", text: "دفع آمن عبر Polar" },
          { icon: "card", text: "بطاقات Visa و Mastercard وغيرها" },
          { icon: "refresh", text: "إلغاء في أي وقت" },
        ],
        activeTitle: "اشتراكك فعّال",
        renewsOn: "يتجدد في",
        endsOn: "ينتهي في",
        cancelScheduled: "ألغيت التجديد. يبقى اشتراكك فعّالًا حتى نهاية الفترة.",
        manage: "إدارة الاشتراك",
        opening: "جارٍ الفتح…",
        pastDueTitle: "تعذّر تجديد اشتراكك",
        pastDueBody: "لم ننجح في تحصيل الدفعة الأخيرة. حدّث وسيلة الدفع لتجنّب إيقاف الحساب.",
        updatePayment: "تحديث وسيلة الدفع",
        expiredTitle: "انتهى اشتراكك",
        expiredBody: "حسابك الآن للقراءة فقط. اختر خطة لتستعيد كل الميزات فورًا، وبياناتك كما هي.",
        renew: "جدّد اشتراكك",
        openingCheckout: "جارٍ فتح صفحة الدفع…",
        confirming: "جارٍ تأكيد الدفع…",
        confirmingBody: "نتحقق من الدفعة مع Polar. لا تغلق الصفحة، يستغرق ذلك ثوانٍ عادةً.",
        slowTitle: "استلمنا طلبك، والتأكيد يأخذ وقتًا أطول من المعتاد",
        slowBody: "إن تمّ الدفع فسيُفعَّل اشتراكك تلقائيًا خلال دقائق. يمكنك التحقق الآن أو المتابعة في التطبيق.",
        checkAgain: "تحقق مرة أخرى",
        closedTitle: "لم تكتمل عملية الدفع",
        closedBody: "أُغلقت نافذة الدفع قبل إتمام الاشتراك. لم يُخصم أي مبلغ.",
        errorTitle: "تعذّر بدء الدفع",
        networkError: "تعذّر الاتصال بخدمة الدفع. تحقق من الاتصال وحاول مرة أخرى.",
        tryAgain: "حاول مرة أخرى",
        dismiss: "إغلاق",
        planChanged: "تم تغيير خطتك. يُعدَّل الرصيد تلقائيًا حسب سياسة Polar.",
        welcome: (plan: string) => `أهلاً فيك في Viresto ${plan}`,
        welcomeBody: "تم تفعيل اشتراكك. كل ميزات خطتك متاحة الآن.",
        toDashboard: "الذهاب إلى لوحة التحكم",
      }
    : {
        locale: "en" as const,
        trialTitle: "You are on the free trial",
        trialDaysLeft: (n: number) => (n === 0 ? "Ends today" : n === 1 ? "1 day left" : `${n} days left`),
        trialBody: "Every feature is available on Pro's limits. Pick your plan before the trial ends to keep going without interruption.",
        trialOf: (total: number) => `of ${total} days`,
        choosePlan: "Choose your plan",
        monthly: "Monthly",
        yearly: "Yearly",
        perMonth: "/ month",
        perYear: "/ year",
        recommended: "Most popular",
        currentPlan: "Your current plan",
        subscribe: "Subscribe now",
        switchPlan: "Switch to this plan",
        switchCycle: "Change billing cycle",
        processing: "Preparing…",
        plansTitle: "Subscription plans",
        plansSubtitle: "Clear prices in USD. Upgrade or cancel at any time.",
        compareTitle: "Compare plans",
        feature: "Feature",
        faqTitle: "Frequently asked questions",
        trust: [
          { icon: "shield", text: "Secure payment via Polar" },
          { icon: "card", text: "Visa, Mastercard and other cards" },
          { icon: "refresh", text: "Cancel anytime" },
        ],
        activeTitle: "Your subscription is active",
        renewsOn: "Renews on",
        endsOn: "Ends on",
        cancelScheduled: "Renewal is cancelled. Your subscription stays active until the end of the period.",
        manage: "Manage subscription",
        opening: "Opening…",
        pastDueTitle: "We could not renew your subscription",
        pastDueBody: "The last payment did not go through. Update your payment method to avoid the account being paused.",
        updatePayment: "Update payment method",
        expiredTitle: "Your subscription has ended",
        expiredBody: "Your account is read-only. Pick a plan to get every feature back at once; your data is untouched.",
        renew: "Renew your subscription",
        openingCheckout: "Opening the payment page…",
        confirming: "Confirming your payment…",
        confirmingBody: "We are checking the payment with Polar. Keep this page open; it usually takes a few seconds.",
        slowTitle: "We got your order; confirmation is taking longer than usual",
        slowBody: "If the payment went through, your subscription activates automatically within minutes. Check now, or keep using the app.",
        checkAgain: "Check again",
        closedTitle: "The payment was not completed",
        closedBody: "The payment window was closed before subscribing. Nothing was charged.",
        errorTitle: "Could not start the payment",
        networkError: "Could not reach the payment service. Check your connection and try again.",
        tryAgain: "Try again",
        dismiss: "Close",
        planChanged: "Your plan was changed. The balance is adjusted automatically per Polar's policy.",
        welcome: (plan: string) => `Welcome to Viresto ${plan}`,
        welcomeBody: "Your subscription is active. Every feature of your plan is available now.",
        toDashboard: "Go to the dashboard",
      };
}

export type SubscriptionCopy = ReturnType<typeof subscriptionCopy>;

// ---------------------------------------------------------------------------
// Shared bits

function Panel({
  tone,
  icon,
  title,
  children,
  actions,
  testId,
}: {
  tone: "green" | "amber" | "red" | "blue" | "gray";
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      role="status"
      className="flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
      style={{
        background: `var(--tone-${tone}-bg)`,
        borderColor: `var(--tone-${tone}-border)`,
      }}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 shrink-0" style={{ color: `var(--tone-${tone}-fg)` }}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="font-black" style={{ color: "var(--text)" }}>
            {title}
          </p>
          {children ? (
            <div className="mt-1 text-sm leading-7" style={{ color: "var(--text-2)" }}>
              {children}
            </div>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  busy,
  testId,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  testId?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled || busy}
      whileTap={reduce || disabled || busy ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.15, ease: EASE_OUT }}
      className="billing-sheen inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      style={{ background: "var(--gold)", color: "var(--on-gold)" }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </motion.button>
  );
}

function SecondaryButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors duration-200"
      style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--card)" }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Trial banner

export function TrialBanner({
  copy,
  daysLeft,
  elapsed,
  totalDays,
  rtl,
  onChoose,
}: {
  copy: SubscriptionCopy;
  daysLeft: number;
  elapsed: number;
  totalDays: number;
  rtl: boolean;
  onChoose: () => void;
}) {
  const reduce = useReducedMotion();
  const urgent = daysLeft <= 3;
  const tone = urgent ? "amber" : "green";
  // The days badge counts down in, from the whole trial to what is left.
  const shownDays = Math.round(useCount(totalDays, daysLeft, true, { delay: 0.25 }));
  return (
    <section
      data-testid="trial-banner"
      className="rounded-2xl border p-4 sm:p-5"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-5 w-5" style={{ color: "var(--gold)" }} aria-hidden />
            <h2 className="text-lg font-black" style={{ color: "var(--text)" }}>
              {copy.trialTitle}
            </h2>
            <span
              className="rounded-full border px-3 py-0.5 text-xs font-black"
              style={{
                color: `var(--tone-${tone}-fg)`,
                background: `var(--tone-${tone}-bg)`,
                borderColor: `var(--tone-${tone}-border)`,
              }}
            >
              <span aria-hidden>{copy.trialDaysLeft(shownDays)}</span>
              <span className="sr-only">{copy.trialDaysLeft(daysLeft)}</span>
            </span>
          </div>
          <p className="mt-2 text-sm leading-7" style={{ color: "var(--text-2)" }}>
            {copy.trialBody}
          </p>
        </div>
        <PrimaryButton onClick={onChoose} testId="trial-choose-plan">
          {copy.choosePlan}
        </PrimaryButton>
      </div>

      <div className="mt-4">
        <div
          className="h-1.5 overflow-hidden rounded-full"
          style={{ background: "var(--card-2)" }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalDays}
          aria-valuenow={totalDays - daysLeft}
          aria-label={copy.trialDaysLeft(daysLeft)}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: `var(--tone-${tone}-solid)`, transformOrigin: rtl ? "right" : "left" }}
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: elapsed }}
            transition={{ duration: reduce ? 0 : COUNT_DURATION, delay: reduce ? 0 : 0.25, ease: EASE_OUT }}
          />
        </div>
        <p className="mt-1.5 text-xs" style={{ color: "var(--muted)" }}>
          <bdi dir="ltr">{totalDays - daysLeft}</bdi> {copy.trialOf(totalDays)}
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Status panels

export function ActiveSubscriptionCard({
  copy,
  planName,
  cycleLabel,
  price,
  periodEnd,
  cancelAtPeriodEnd,
  managing,
  onManage,
}: {
  copy: SubscriptionCopy;
  planName: string;
  cycleLabel: string;
  price: string;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  managing: boolean;
  onManage: () => void;
}) {
  return (
    <section
      data-testid="active-subscription"
      className="rounded-2xl border p-4 sm:p-5"
      style={{ background: "var(--card)", borderColor: "var(--tone-green-border)" }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "var(--tone-green-bg)", color: "var(--tone-green-fg)" }}
          >
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold" style={{ color: "var(--muted)" }}>
              {copy.activeTitle}
            </p>
            <p className="mt-0.5 text-2xl font-black" style={{ color: "var(--text)" }}>
              Viresto {planName}
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-2)" }}>
              <bdi dir="ltr" className="font-black">{price}</bdi> · {cycleLabel}
              {periodEnd ? (
                <>
                  {" · "}
                  {cancelAtPeriodEnd ? copy.endsOn : copy.renewsOn} <bdi dir="ltr">{periodEnd}</bdi>
                </>
              ) : null}
            </p>
            {cancelAtPeriodEnd ? (
              <p className="mt-2 text-sm" style={{ color: "var(--tone-amber-fg)" }}>
                {copy.cancelScheduled}
              </p>
            ) : null}
          </div>
        </div>
        <PrimaryButton onClick={onManage} busy={managing} testId="manage-subscription">
          {managing ? copy.opening : copy.manage}
        </PrimaryButton>
      </div>
    </section>
  );
}

export function PastDueNotice({ copy, opening, onUpdate }: { copy: SubscriptionCopy; opening: boolean; onUpdate: () => void }) {
  return (
    <Panel
      tone="red"
      testId="past-due-notice"
      icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
      title={copy.pastDueTitle}
      actions={
        <PrimaryButton onClick={onUpdate} busy={opening}>
          {copy.updatePayment}
        </PrimaryButton>
      }
    >
      {copy.pastDueBody}
    </Panel>
  );
}

export function ExpiredNotice({ copy, onRenew }: { copy: SubscriptionCopy; onRenew: () => void }) {
  return (
    <Panel
      tone="amber"
      testId="expired-notice"
      icon={<Lock className="h-5 w-5" aria-hidden />}
      title={copy.expiredTitle}
      actions={<PrimaryButton onClick={onRenew}>{copy.renew}</PrimaryButton>}
    >
      {copy.expiredBody}
    </Panel>
  );
}

export type CheckoutNotice =
  | { kind: "opening" }
  | { kind: "confirming" }
  | { kind: "slow" }
  | { kind: "closed" }
  | { kind: "error"; message: string }
  | { kind: "info"; message: string };

export function CheckoutStatus({
  copy,
  notice,
  onCheckAgain,
  onDismiss,
}: {
  copy: SubscriptionCopy;
  notice: CheckoutNotice;
  onCheckAgain: () => void;
  onDismiss: () => void;
}) {
  const close = <SecondaryButton onClick={onDismiss}>{copy.dismiss}</SecondaryButton>;
  switch (notice.kind) {
    case "opening":
      return (
        <Panel tone="blue" testId="checkout-opening" icon={<Loader2 className="h-5 w-5 animate-spin" aria-hidden />} title={copy.openingCheckout} />
      );
    case "confirming":
      return (
        <Panel tone="blue" testId="checkout-confirming" icon={<Loader2 className="h-5 w-5 animate-spin" aria-hidden />} title={copy.confirming}>
          {copy.confirmingBody}
        </Panel>
      );
    case "slow":
      return (
        <Panel
          tone="amber"
          testId="checkout-slow"
          icon={<RefreshCw className="h-5 w-5" aria-hidden />}
          title={copy.slowTitle}
          actions={
            <>
              <PrimaryButton onClick={onCheckAgain}>{copy.checkAgain}</PrimaryButton>
              {close}
            </>
          }
        >
          {copy.slowBody}
        </Panel>
      );
    case "closed":
      return (
        <Panel tone="gray" testId="checkout-closed" icon={<X className="h-5 w-5" aria-hidden />} title={copy.closedTitle} actions={close}>
          {copy.closedBody}
        </Panel>
      );
    case "error":
      return (
        <Panel tone="red" testId="checkout-error" icon={<AlertTriangle className="h-5 w-5" aria-hidden />} title={copy.errorTitle} actions={close}>
          {notice.message}
        </Panel>
      );
    case "info":
      return (
        <Panel tone="green" testId="checkout-info" icon={<Check className="h-5 w-5" aria-hidden />} title={notice.message} actions={close} />
      );
  }
}

// ---------------------------------------------------------------------------
// Success: checkmark + light confetti

const CONFETTI = Array.from({ length: CONFETTI_PIECES }, (_, i) => ({
  x: Math.cos((i / CONFETTI_PIECES) * Math.PI * 2 + (i % 2) * 0.12) * (64 + (i % 5) * 20),
  y: Math.sin((i / CONFETTI_PIECES) * Math.PI * 2 + (i % 2) * 0.12) * (42 + (i % 4) * 16) - 22,
  rotate: (i * 47) % 360,
  color: ["var(--gold)", "var(--tone-green-solid)", "var(--tone-blue-solid)", "var(--gold-border)"][i % 4],
}));

export function SubscriptionSuccess({
  copy,
  planName,
  onDashboard,
}: {
  copy: SubscriptionCopy;
  planName: string;
  onDashboard: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <section
      data-testid="subscription-success"
      role="status"
      className="relative overflow-hidden rounded-2xl border px-4 py-8 text-center sm:py-10"
      style={{ background: "var(--card)", borderColor: "var(--tone-green-border)" }}
    >
      <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
        {!reduce &&
          CONFETTI.map((piece, i) => (
            <motion.span
              key={i}
              aria-hidden
              className="absolute h-2 w-1.5 rounded-sm"
              style={{ background: piece.color }}
              initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
              animate={{ x: piece.x, y: piece.y, opacity: [0, 1, 0], rotate: piece.rotate }}
              transition={{ duration: 1.25, ease: EASE_OUT, delay: 0.25 + (i % 6) * 0.025 }}
            />
          ))}
        <motion.span
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: "var(--tone-green-solid)", color: "#fff" }}
          initial={reduce ? false : { scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
        >
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2.6} aria-hidden>
            <motion.path
              d="M5 12.5l4.5 4.5L19 7.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.15 }}
            />
          </svg>
        </motion.span>
      </div>
      <h2 className="mt-5 text-2xl font-black" style={{ color: "var(--text)" }}>
        {copy.welcome(planName)}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7" style={{ color: "var(--text-2)" }}>
        {copy.welcomeBody}
      </p>
      <div className="mt-5">
        <PrimaryButton onClick={onDashboard} testId="success-dashboard">
          {copy.toDashboard}
        </PrimaryButton>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Plans

export type PlanCardData = {
  code: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  monthly: string;
  yearly: string;
  purchasable: { monthly: boolean; yearly: boolean };
};

export function CycleToggle({
  copy,
  cycle,
  onChange,
}: {
  copy: SubscriptionCopy;
  cycle: "monthly" | "yearly";
  onChange: (cycle: "monthly" | "yearly") => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div
      className="inline-flex items-center gap-1 rounded-xl border p-1"
      style={{ borderColor: "var(--border)", background: "var(--card-2)" }}
      role="radiogroup"
      aria-label={copy.monthly + " / " + copy.yearly}
      data-testid="cycle-toggle"
    >
      {(["monthly", "yearly"] as const).map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={cycle === value}
          onClick={() => onChange(value)}
          className="relative rounded-lg px-4 py-2 text-sm font-black"
          style={{ color: cycle === value ? "var(--on-gold)" : "var(--text)" }}
        >
          {cycle === value && (
            <motion.span
              layoutId="cycle-pill"
              className="absolute inset-0 rounded-lg"
              style={{ background: "var(--gold)" }}
              transition={reduce ? { duration: 0 } : TOGGLE_SPRING}
            />
          )}
          <span className="relative">{value === "monthly" ? copy.monthly : copy.yearly}</span>
        </button>
      ))}
    </div>
  );
}

/** The first price shown counts up from 0; later prices roll in whole. */
function CountUpPrice({ value, start, delay }: { value: string; start: boolean; delay: number }) {
  const parts = splitPrice(value);
  const counted = useCount(0, parts?.value ?? 0, start, { delay });
  if (!parts) return <>{value}</>;
  // The count is visual only; the page's text (screen readers, search,
  // copy) always carries the real price, even before the card is seen.
  return (
    <>
      <span aria-hidden>
        {parts.before}
        {formatCount(parts.decimals ? counted : Math.round(counted), parts.decimals)}
        {parts.after}
      </span>
      <span className="sr-only">{value}</span>
    </>
  );
}

function AnimatedPrice({
  value,
  suffix,
  inView,
  delay,
  savings,
}: {
  value: string;
  suffix: string;
  inView: boolean;
  delay: number;
  savings: string | null;
}) {
  const reduce = useReducedMotion();
  const [first] = useState(value);
  return (
    <div>
      <div dir="ltr" className="flex items-baseline justify-center gap-1.5">
        <span className="relative inline-flex overflow-hidden py-1">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={value}
              data-testid="plan-price"
              className="text-4xl font-black tracking-tight tabular-nums"
              style={{ color: "var(--text)" }}
              initial={reduce ? false : { y: "100%", opacity: 0 }}
              animate={{ y: "0%", opacity: 1 }}
              exit={reduce ? undefined : { y: "-100%", opacity: 0 }}
              transition={{ duration: 0.38, ease: EASE_OUT }}
            >
              {value === first ? <CountUpPrice value={value} start={inView} delay={delay} /> : value}
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="text-sm font-bold" style={{ color: "var(--muted)" }} dir="auto">
          {suffix}
        </span>
      </div>
      <div className="flex h-7 items-end justify-center">
        <AnimatePresence initial={false}>
          {savings && (
            <motion.span
              key="savings"
              data-testid="yearly-savings"
              className="rounded-full border px-2.5 py-0.5 text-xs font-black"
              style={{
                color: "var(--tone-green-fg)",
                background: "var(--tone-green-bg)",
                borderColor: "var(--tone-green-border)",
              }}
              initial={reduce ? false : { opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? undefined : { opacity: 0, x: -18 }}
              transition={{ duration: 0.32, ease: EASE_OUT }}
            >
              {savings}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** A checkmark whose stroke draws in once its card is on screen. */
function DrawnCheck({ start, delay }: { start: boolean; delay: number }) {
  const reduce = useReducedMotion();
  return (
    <svg
      viewBox="0 0 24 24"
      className="mt-0.5 h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      style={{ color: "var(--tone-green-fg)" }}
      aria-hidden
    >
      <motion.path
        d="M5 12.5l4.5 4.5L19 7.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0, opacity: 0 }}
        animate={start || reduce ? { pathLength: 1, opacity: 1 } : undefined}
        transition={{ duration: 0.4, delay, ease: EASE_OUT }}
      />
    </svg>
  );
}

function planFeatures(code: string) {
  return PLANS.find((plan) => plan.code === code)?.features ?? [];
}

export function PlanCards({
  copy,
  plans,
  cycle,
  recommended,
  currentCode,
  currentCycle,
  busyKey,
  busyLabel,
  onSelect,
  baseDelay = 0,
}: {
  copy: SubscriptionCopy;
  plans: PlanCardData[];
  cycle: "monthly" | "yearly";
  recommended: string;
  currentCode: string | null;
  currentCycle: "monthly" | "yearly" | null;
  busyKey: string | null;
  /** Shown on the busy button; defaults to "processing". */
  busyLabel?: string | null;
  onSelect: (code: string, cycle: "monthly" | "yearly") => void;
  /** When the cards' section starts its entrance (s); the cards follow 80ms apart. */
  baseDelay?: number;
}) {
  return (
    <div className="grid items-stretch gap-4 md:grid-cols-3" data-testid="plan-cards">
      {plans.map((plan, index) => (
        <PlanCard
          key={plan.code}
          copy={copy}
          plan={plan}
          cycle={cycle}
          isRecommended={plan.code === recommended}
          isCurrent={currentCode === plan.code}
          hasCurrent={currentCode !== null}
          isCurrentSelection={currentCode === plan.code && currentCycle === cycle}
          busyKey={busyKey}
          busyLabel={busyLabel}
          onSelect={onSelect}
          delay={baseDelay + index * BILLING_ENTRANCE.stagger}
        />
      ))}
    </div>
  );
}

function PlanCard({
  copy,
  plan,
  cycle,
  isRecommended,
  isCurrent,
  hasCurrent,
  isCurrentSelection,
  busyKey,
  busyLabel,
  onSelect,
  delay,
}: {
  copy: SubscriptionCopy;
  plan: PlanCardData;
  cycle: "monthly" | "yearly";
  isRecommended: boolean;
  isCurrent: boolean;
  hasCurrent: boolean;
  isCurrentSelection: boolean;
  busyKey: string | null;
  busyLabel?: string | null;
  onSelect: (code: string, cycle: "monthly" | "yearly") => void;
  delay: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  const key = `${plan.code}:${cycle}`;
  const label = isCurrentSelection
    ? copy.currentPlan
    : isCurrent
      ? copy.switchCycle
      : hasCurrent
        ? copy.switchPlan
        : copy.subscribe;
  const configured = PLANS.find((item) => item.code === plan.code);
  const savings = cycle === "yearly" && configured ? formatYearlySavings(configured, copy.locale) : null;
  const gold = isRecommended && !isCurrentSelection;
  const busy = busyKey === key;
  const disabled = isCurrentSelection || busyKey !== null || !plan.purchasable[cycle];
  // After the card has risen in: the checkmarks draw, the price counts.
  const settle = reduce ? 0 : delay + BILLING_ENTRANCE.duration * 0.6;

  return (
    // The entrance lives on the wrapper so the card's own transform stays
    // free for the CSS hover lift (.billing-plan-card).
    <motion.div
      className="h-full"
      initial={reduce ? false : { opacity: 0, y: BILLING_ENTRANCE.rise }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: BILLING_ENTRANCE.duration, delay, ease: EASE_OUT }}
    >
      <article
        ref={ref}
        data-testid={`plan-card-${plan.code}`}
        data-recommended={isRecommended || undefined}
        className={[
          "billing-plan-card relative isolate flex h-full flex-col rounded-2xl border p-5 sm:p-6",
          isRecommended ? "plan-card-recommended" : "",
        ].join(" ")}
        style={{
          background: "var(--card)",
          borderColor: isRecommended ? "var(--gold-border)" : "var(--border)",
        }}
      >
        {isRecommended && (
          <>
            <span className="billing-glow" aria-hidden />
            <span className="billing-border-light" aria-hidden />
            <motion.span
              className="absolute -top-3 start-5 rounded-full px-3 py-1 text-xs font-black"
              style={{ background: "var(--gold)", color: "var(--on-gold)" }}
              // One soft pulse once the card has settled, then still.
              animate={reduce ? undefined : { scale: [1, 1.07, 1] }}
              transition={{ duration: 0.7, delay: settle + 0.35, ease: "easeInOut" }}
            >
              {copy.recommended}
            </motion.span>
          </>
        )}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-xl font-black" style={{ color: "var(--text)" }}>
              {plan.name}
            </h3>
            {plan.subtitle ? (
              <p className="mt-0.5 text-sm font-bold" style={{ color: "var(--muted)" }}>
                {plan.subtitle}
              </p>
            ) : null}
          </div>
          {isCurrent && (
            <span
              className="rounded-full border px-2.5 py-0.5 text-xs font-black"
              style={{ color: "var(--tone-green-fg)", background: "var(--tone-green-bg)", borderColor: "var(--tone-green-border)" }}
            >
              {copy.currentPlan}
            </span>
          )}
        </div>

        <p className="mt-3 min-h-12 text-sm leading-6" style={{ color: "var(--text-2)" }}>
          {plan.description}
        </p>

        <div className="my-5 rounded-xl pb-2 pt-4" style={{ background: "var(--card-2)" }}>
          <AnimatedPrice
            value={cycle === "yearly" ? plan.yearly : plan.monthly}
            suffix={cycle === "yearly" ? copy.perYear : copy.perMonth}
            inView={inView}
            delay={settle}
            savings={savings}
          />
        </div>

        <ul className="space-y-2.5 text-sm">
          {planFeatures(plan.code).map((feature, i) => (
            <li key={feature.label} className="flex items-start gap-2 leading-6">
              {feature.included ? (
                <DrawnCheck start={inView} delay={settle + i * 0.05} />
              ) : (
                <X className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--muted)" }} aria-hidden />
              )}
              <span style={{ color: feature.included ? "var(--text)" : "var(--muted)" }}>
                {feature.label}
                {feature.value ? (
                  <>
                    {" "}
                    <bdi dir="ltr" style={{ color: "var(--muted)" }}>
                      ({feature.value})
                    </bdi>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-6">
          <motion.button
            type="button"
            data-testid={`subscribe-${plan.code}`}
            disabled={disabled}
            onClick={() => onSelect(plan.code, cycle)}
            whileTap={reduce || disabled ? undefined : { scale: 0.98 }}
            transition={{ duration: 0.15, ease: EASE_OUT }}
            className={[
              "billing-sheen inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60",
              gold ? "" : "billing-sheen-quiet",
            ].join(" ")}
            style={
              gold
                ? { background: "var(--gold)", color: "var(--on-gold)" }
                : { background: "var(--card-2)", color: "var(--text)", border: "1px solid var(--border)" }
            }
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {busy ? busyLabel || copy.processing : label}
          </motion.button>
        </div>
      </article>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Comparison table (reveals on scroll)

type CompareRow = { label: string; values: Record<PlanCode, string | boolean> };

function compareRows(isArabic: boolean): CompareRow[] {
  const by = (pick: (plan: (typeof PLANS)[number]) => string | boolean) =>
    Object.fromEntries(PLANS.map((plan) => [plan.code, pick(plan)])) as Record<PlanCode, string | boolean>;
  const number = (n: number) => n.toLocaleString("en-US");
  const tokens = (n: number) => (n >= 1_000_000 ? `${n / 1_000_000}M` : number(n));
  return [
    { label: isArabic ? "المستخدمون" : "Users", values: by((p) => number(p.limits.users)) },
    { label: isArabic ? "الموكلون" : "Clients", values: by((p) => number(p.limits.clients)) },
    { label: isArabic ? "القضايا" : "Cases", values: by((p) => number(p.limits.cases)) },
    { label: isArabic ? "التخزين" : "Storage", values: by((p) => `${p.limits.storageGb}GB`) },
    { label: isArabic ? "إدارة الفريق والأدوار" : "Team and roles", values: by((p) => p.entitlements.teamManagement) },
    { label: isArabic ? "تقارير متقدمة" : "Advanced reports", values: by((p) => p.entitlements.advancedReports) },
    { label: isArabic ? "تصدير PDF / Excel كامل" : "Full PDF / Excel export", values: by((p) => p.entitlements.fullExport) },
    {
      label: isArabic ? "المساعد الذكي (tokens شهريًا)" : "AI assistant (tokens / month)",
      values: by((p) => (p.limits.aiEnabled ? tokens(p.limits.aiMonthlyTokens) : false)),
    },
    {
      label: isArabic ? "سجل النشاط (أيام)" : "Activity history (days)",
      values: by((p) => number(p.limits.activityRetentionDays)),
    },
  ];
}

export function ComparisonTable({ copy, isArabic, recommended }: { copy: SubscriptionCopy; isArabic: boolean; recommended: string }) {
  const reduce = useReducedMotion();
  const rows = compareRows(isArabic);
  return (
    <motion.section
      data-testid="comparison-table"
      {...revealOnScroll(reduce)}
      className="rounded-2xl border"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <h2 className="px-4 pt-4 text-lg font-black sm:px-5 sm:pt-5" style={{ color: "var(--text)" }}>
        {copy.compareTitle}
      </h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr style={{ background: "var(--card-2)" }}>
              <th scope="col" className="sticky start-0 z-10 px-4 py-3 text-start font-black sm:px-5" style={{ color: "var(--text)", background: "var(--card-2)" }}>
                {copy.feature}
              </th>
              {PLANS.map((plan) => (
                <th
                  key={plan.code}
                  scope="col"
                  className="px-3 py-3 text-center font-black"
                  style={{ color: plan.code === recommended ? "var(--gold)" : "var(--text)" }}
                >
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t" style={{ borderColor: "var(--border)" }}>
                <th scope="row" className="sticky start-0 z-10 px-4 py-3 text-start font-bold sm:px-5" style={{ color: "var(--text-2)", background: "var(--card)" }}>
                  {row.label}
                </th>
                {PLANS.map((plan) => {
                  const value = row.values[plan.code];
                  return (
                    <td key={plan.code} className="px-3 py-3 text-center">
                      {value === true ? (
                        <Check className="mx-auto h-4 w-4" style={{ color: "var(--tone-green-fg)" }} aria-label={isArabic ? "متاح" : "Included"} />
                      ) : value === false ? (
                        <X className="mx-auto h-4 w-4" style={{ color: "var(--muted)" }} aria-label={isArabic ? "غير متاح" : "Not included"} />
                      ) : (
                        <bdi dir="ltr" className="font-black" style={{ color: "var(--text)" }}>
                          {value}
                        </bdi>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// Trust row and FAQ

export function TrustRow({ copy }: { copy: SubscriptionCopy }) {
  const icons = { shield: ShieldCheck, card: CreditCard, refresh: RefreshCw } as const;
  return (
    <ul data-testid="trust-row" className="grid gap-3 sm:grid-cols-3">
      {copy.trust.map((item) => {
        const Icon = icons[item.icon as keyof typeof icons];
        return (
          <li
            key={item.text}
            className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-bold"
            style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text-2)" }}
          >
            <Icon className="h-5 w-5 shrink-0" style={{ color: "var(--gold)" }} aria-hidden />
            {item.text}
          </li>
        );
      })}
    </ul>
  );
}

function faqItems(isArabic: boolean, trialDays: number) {
  return isArabic
    ? [
        {
          q: "هل يمكنني الإلغاء في أي وقت؟",
          a: "نعم. تلغي التجديد من «إدارة الاشتراك» بنقرة، ويبقى اشتراكك فعّالًا حتى نهاية الفترة المدفوعة، دون أي رسوم إضافية.",
        },
        {
          q: "هل الدفع آمن؟",
          a: "يتم الدفع عبر Polar، وهي منصة دفع موثوقة. لا تمر بيانات بطاقتك عبر Viresto ولا نخزّنها.",
        },
        {
          q: "ماذا يحدث بعد انتهاء الفترة التجريبية؟",
          a: `بعد ${trialDays} يومًا يصبح الحساب للقراءة فقط إن لم تشترك. بياناتك تبقى كما هي، وتعود كل الميزات فور الاشتراك.`,
        },
        {
          q: "هل يمكنني تغيير خطتي لاحقًا؟",
          a: "نعم، ترقية أو تخفيض في أي وقت، ويُحتسب الفرق تلقائيًا حسب المدة المتبقية.",
        },
      ]
    : [
        { q: "Can I cancel anytime?", a: "Yes. Cancel the renewal from “Manage subscription” in one click; your subscription stays active until the end of the paid period, with no extra fees." },
        { q: "Is payment secure?", a: "Payments go through Polar, a trusted payment platform. Your card details never pass through Viresto and are never stored by us." },
        { q: "What happens after the trial?", a: `After ${trialDays} days the account becomes read-only unless you subscribe. Your data stays as it is, and every feature returns as soon as you subscribe.` },
        { q: "Can I change my plan later?", a: "Yes, upgrade or downgrade at any time; the difference is prorated automatically." },
      ];
}

export function BillingFaq({ copy, isArabic, trialDays }: { copy: SubscriptionCopy; isArabic: boolean; trialDays: number }) {
  const [open, setOpen] = useState<number | null>(0);
  const reduce = useReducedMotion();
  const items = faqItems(isArabic, trialDays);
  return (
    <motion.section
      data-testid="billing-faq"
      {...revealOnScroll(reduce)}
      className="rounded-2xl border"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <h2 className="px-4 pt-4 text-lg font-black sm:px-5 sm:pt-5" style={{ color: "var(--text)" }}>
        {copy.faqTitle}
      </h2>
      <div className="mt-2">
        {items.map((item, index) => {
          const isOpen = open === index;
          const id = `billing-faq-${index}`;
          return (
            <div key={item.q} className="border-t" style={{ borderColor: "var(--border)" }}>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={id}
                onClick={() => setOpen(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-start text-sm font-black sm:px-5"
                style={{ color: "var(--text)" }}
              >
                {item.q}
                <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: reduce ? 0 : 0.25, ease: EASE_OUT }}>
                  <ChevronDown className="h-4 w-4" style={{ color: "var(--muted)" }} aria-hidden />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    id={id}
                    initial={reduce ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={reduce ? undefined : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: EASE_OUT }}
                    className="overflow-hidden"
                  >
                    <p className="px-4 pb-4 text-sm leading-7 sm:px-5" style={{ color: "var(--text-2)" }}>
                      {item.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}
