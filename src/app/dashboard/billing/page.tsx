"use client";

// The subscriptions page. Checkout opens embedded in the page
// (@polar-sh/checkout/embed); the subscription is activated only by the
// server: POST /api/billing/checkout/confirm verifies the checkout with
// Polar and syncs it, and the Polar webhook does the same on its own.
// This page polls until the office is paid, then drops every cached plan
// figure of this user and office.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { BILLING_ENTRANCE, entrance, revealOnScroll } from "@/components/billing/billing-motion";
import { formatLimit } from "@/config/plans";
import { useLocale } from "@/lib/useLocale";
import { translations } from "@/lib/i18n";
import AppLoader from "@/components/ui/AppLoader";
import { PageHeader } from "@/components/page";
import { TRIAL_DAYS, isPlanCode } from "@/lib/trial-copy";
import TrialStatusCard from "@/components/billing/TrialStatusCard";
import { useTenantAccessSummary } from "@/hooks/useTenantAccessSummary";
import {
  invalidateTenantWriteAccessCache,
  requestTenantWriteAccess,
  type TenantAccessSummary,
} from "@/lib/tenant-write-access-cache";
import { DEMO_BLOCKED_CODE, DEMO_BLOCKED_MESSAGE } from "@/lib/demo/constants";
import { leaveDemoSession, refreshDemoMode } from "@/lib/demo/client";
import { formatInZone } from "@/lib/datetime";
import {
  billingView,
  onSubscriptionChanged,
  openEmbedWithin,
  reportEmbedOutcome,
  requestCheckout,
  trialProgress,
  waitForActivation,
  type ActivationCheck,
  type CheckoutCycle,
} from "@/lib/billing/checkout-flow";
import {
  ActiveSubscriptionCard,
  BillingFaq,
  CheckoutStatus,
  ComparisonTable,
  CycleToggle,
  ExpiredNotice,
  PastDueNotice,
  PlanCards,
  SubscriptionSuccess,
  TrialBanner,
  TrustRow,
  subscriptionCopy,
  type CheckoutNotice,
  type PlanCardData,
} from "@/components/billing/SubscriptionSections";

type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED" | "UNPAID";

interface Money {
  raw: number;
  value: number;
  currency: string;
  formatted: string;
}

interface UsageItem {
  used: number;
  limit: number | null;
  percent: number | null;
}

interface BillingPlan {
  id: string;
  code: string;
  name: string;
  subtitle?: string | null;
  description?: string | null;
  priceMonthly: Money;
  priceYearly: Money;
  isCurrent?: boolean;
  purchasable?: { monthly: boolean; yearly: boolean };
}

interface BillingData {
  access?: TenantAccessSummary;
  tenant: {
    id: string;
    name: string;
    subscriptionStatus: SubscriptionStatus;
    trialEndsAt?: string | null;
    signupPlanCode?: string | null;
  };
  subscription: {
    status: SubscriptionStatus;
    interval: "MONTHLY" | "YEARLY";
    amount: Money;
    trialEndsAt?: string | null;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd: boolean;
    plan: BillingPlan;
  } | null;
  currentPlan: BillingPlan;
  usage: Record<"users" | "clients" | "cases" | "documents" | "storage" | "ai" | "payments" | "invoices", UsageItem>;
  availablePlans: BillingPlan[];
}

const POLL_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 2_000;
const SUBSCRIPTION_SIGNATURE_KEY = "viresto_subscription_signature";

/**
 * One check of the checkout: "active" once the office is paid (this
 * checkout confirmed now, or the webhook got there first), "in_demo" when
 * this tab is a demo session (billing is closed there), else "pending".
 * Both requests bypass the client caches.
 */
async function checkCheckoutActivation(checkoutId: string | null): Promise<ActivationCheck> {
  if (checkoutId) {
    const res = await fetch("/api/billing/checkout/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkoutId }),
      cache: "no-store",
    }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};

    if (res?.status === 403 && json?.details?.code === DEMO_BLOCKED_CODE) return "in_demo";
    if (json?.data?.synced) return "active";
  }

  const access = await requestTenantWriteAccess(true);
  return access?.access?.state === "PAID" ? "active" : "pending";
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return null;
  return formatInZone(value, locale === "ar" ? "ar" : "en", { year: "numeric", month: "short", day: "numeric" });
}

function isDarkTheme() {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

type EmbedInstance = { close: () => void };

export default function BillingPage() {
  const { locale } = useLocale();
  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const billing = translations[locale].billingPage;
  const copy = useMemo(() => subscriptionCopy(isArabic), [isArabic]);
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const usageLabels: Record<keyof BillingData["usage"], string> = {
    users: billing.users,
    clients: billing.clients,
    cases: billing.cases,
    documents: billing.documents,
    storage: isArabic ? "التخزين" : "Storage",
    ai: isArabic ? "استهلاك الذكاء الاصطناعي" : "AI token usage",
    payments: billing.payments,
    invoices: billing.invoices,
  };

  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // /api/billing is admin-only; team members get the trial/lock notice.
  const [memberView, setMemberView] = useState(false);
  const [demoBlocked, setDemoBlocked] = useState(false);
  const memberAccess = useTenantAccessSummary();

  const [cycle, setCycle] = useState<CheckoutCycle>("monthly");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [portalOpening, setPortalOpening] = useState(false);
  const [notice, setNotice] = useState<CheckoutNotice | null>(null);
  const [successPlan, setSuccessPlan] = useState<string | null>(null);

  const embedRef = useRef<EmbedInstance | null>(null);
  const pollRef = useRef<AbortController | null>(null);
  const pendingCheckoutRef = useRef<{ checkoutId: string | null; planName: string } | null>(null);
  // The ?checkout=success return, read once (undefined = not read yet).
  const checkoutReturnRef = useRef<{ checkoutId: string | null; url: string } | null | undefined>(undefined);

  const load = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!options.silent) setLoading(true);
      setLoadError(null);

      const res = await fetch("/api/billing", { cache: "no-store" }).catch(() => null);
      const json = res ? await res.json().catch(() => ({})) : {};

      if (res?.status === 401) {
        window.location.href = "/login";
        return null;
      }
      if (res?.status === 403) {
        if (json?.details?.code === DEMO_BLOCKED_CODE) setDemoBlocked(true);
        else setMemberView(true);
        setLoading(false);
        return null;
      }
      if (!res?.ok || !json.success) {
        setLoadError(json?.message || billing.loadError);
        setLoading(false);
        return null;
      }

      const next = json.data as BillingData;
      setData(next);
      setLoading(false);
      invalidateTenantWriteAccessCache();

      // A change made outside this page (cancel or plan change in Polar's
      // customer portal): drop cached plan figures of this user and office.
      const signature = [
        next.access?.state,
        next.subscription?.status,
        next.subscription?.plan.code,
        next.subscription?.interval,
        next.subscription?.cancelAtPeriodEnd,
      ].join("|");
      try {
        const previous = window.sessionStorage.getItem(SUBSCRIPTION_SIGNATURE_KEY);
        window.sessionStorage.setItem(SUBSCRIPTION_SIGNATURE_KEY, signature);
        if (previous !== null && previous !== signature) {
          await onSubscriptionChanged(() => requestTenantWriteAccess(true));
        }
      } catch {
        // Storage blocked: the check below each activation still runs.
      }
      return next;
    },
    [billing.loadError],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(
    () => () => {
      pollRef.current?.abort();
      embedRef.current?.close();
    },
    [],
  );

  /** Poll the server until the subscription is active (never activates it here). */
  const confirmActivation = useCallback(
    async (checkoutId: string | null, planName: string, returnUrl?: string) => {
      pollRef.current?.abort();
      const controller = new AbortController();
      pollRef.current = controller;
      pendingCheckoutRef.current = { checkoutId, planName };
      setNotice({ kind: "confirming" });

      const outcome = await waitForActivation({
        check: () => checkCheckoutActivation(checkoutId),
        timeoutMs: POLL_TIMEOUT_MS,
        intervalMs: POLL_INTERVAL_MS,
        signal: controller.signal,
      });

      if (outcome === "aborted") return outcome;
      if (outcome === "in_demo") {
        // This tab's cookie is a demo session: back to the real office, then
        // start over on the same return URL with the real cookie.
        if (await leaveDemoSession()) window.location.replace(returnUrl ?? "/dashboard/billing");
        else window.location.replace("/dashboard");
        return outcome;
      }
      if (outcome === "timeout") {
        setNotice({ kind: "slow" });
        return outcome;
      }

      pendingCheckoutRef.current = null;
      await onSubscriptionChanged(() => requestTenantWriteAccess(true));
      refreshDemoMode();
      const next = await load({ silent: true });
      setNotice(null);
      setSuccessPlan(next?.subscription?.plan.name ?? planName);
      router.refresh();
      return outcome;
    },
    [load, router],
  );

  // Fallback when the checkout was opened as a page (no embedding):
  // back from Polar with ?checkout=success&checkout_id=…
  // The URL is read once (a ref, kept across React's dev double-run of
  // effects); the polling belongs to each run of the effect and is aborted
  // by its cleanup, so a second run starts it again instead of finding it
  // aborted.
  useEffect(() => {
    if (checkoutReturnRef.current === undefined) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("checkout") === "success") {
        checkoutReturnRef.current = {
          checkoutId: params.get("checkout_id"),
          url: window.location.pathname + window.location.search,
        };
        // Polar also appends customer_session_token: keep it out of the
        // address bar and the history.
        params.delete("checkout");
        params.delete("checkout_id");
        params.delete("customer_session_token");
        const query = params.toString();
        window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : ""));
      } else {
        checkoutReturnRef.current = null;
      }
    }

    const landing = checkoutReturnRef.current;
    if (!landing) return undefined;
    void confirmActivation(landing.checkoutId, "", landing.url).then((outcome) => {
      // Finished (activated, "taking longer", demo): never again for this
      // URL. An aborted run leaves it for the next run of this effect.
      if (outcome !== "aborted") checkoutReturnRef.current = null;
    });
    return () => pollRef.current?.abort();
  }, [confirmActivation]);

  const openPortal = useCallback(async () => {
    setPortalOpening(true);
    const res = await fetch("/api/billing/portal", { method: "POST" }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok && json.data?.url) {
      window.location.href = json.data.url;
      return;
    }
    setPortalOpening(false);
    setNotice({ kind: "error", message: json.message || copy.networkError });
  }, [copy.networkError]);

  async function startPurchase(planCode: string, planName: string, selectedCycle: CheckoutCycle) {
    setNotice(null);
    setBusyKey(`${planCode}:${selectedCycle}`);
    const result = await requestCheckout(planCode, selectedCycle);

    switch (result.kind) {
      case "unauthorized":
        window.location.href = "/login";
        return;
      case "portal":
        setBusyKey(null);
        await openPortal();
        return;
      case "error":
        setBusyKey(null);
        setNotice({
          kind: "error",
          message: result.code === "NETWORK" ? copy.networkError : result.message || copy.networkError,
        });
        return;
      case "updated":
        setBusyKey(null);
        await onSubscriptionChanged(() => requestTenantWriteAccess(true));
        await load({ silent: true });
        setNotice({ kind: "info", message: copy.planChanged });
        return;
      case "checkout":
        break;
    }

    let leavingForCheckout = false;
    try {
      setNotice({ kind: "opening" });
      const { PolarEmbedCheckout } = await import("@polar-sh/checkout/embed");
      // The "opening" notice stays up for the whole wait (up to ~12s when
      // the checkout is slow).
      const opened = await openEmbedWithin({
        create: () => PolarEmbedCheckout.create(result.url, { theme: isDarkTheme() ? "dark" : "light" }),
        checkoutUrl: result.url,
        embedOrigin: result.embedOrigin,
      });
      reportEmbedOutcome(opened, opened.elapsedMs);
      if (opened.kind === "refused") {
        // Polar refused to frame the checkout here, or nothing came at all:
        // open it as a page (the "opening" notice stays up meanwhile). Its
        // success URL brings the admin back here
        // (?checkout=success&checkout_id=…), to the same confirmation.
        leavingForCheckout = true;
        window.location.href = result.url;
        return;
      }
      setNotice(null);
      const embed = opened.embed;
      embedRef.current = embed;
      let succeeded = false;

      embed.addEventListener("success", (event) => {
        // Stay in the app: no redirect to the success URL.
        event.preventDefault();
        succeeded = true;
        embed.close();
        embedRef.current = null;
        void confirmActivation(result.checkoutId, planName);
      });
      embed.addEventListener("close", () => {
        embedRef.current = null;
        // Closed by the user before paying (a failed card stays inside the
        // checkout, which shows the error itself).
        if (!succeeded) setNotice({ kind: "closed" });
      });
    } catch {
      setNotice({ kind: "error", message: copy.networkError });
    } finally {
      // Leaving for the checkout page: keep the button busy until it unloads.
      if (!leavingForCheckout) setBusyKey(null);
    }
  }

  function scrollToPlans() {
    document.getElementById("billing-plans")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (loading) return <AppLoader fullScreen={false} />;

  if (demoBlocked) {
    return (
      <div className="min-w-0 space-y-4" dir={dir}>
        <PageHeader dir={dir} title={billing.title} description={billing.subtitle} />
        <div className="card p-6 text-sm font-semibold" style={{ color: "var(--muted)" }}>
          {isArabic ? DEMO_BLOCKED_MESSAGE : "Billing is not available in demo mode. Go back to your office to use it."}
        </div>
      </div>
    );
  }

  if (memberView) {
    return (
      <div className="min-w-0 space-y-4" dir={dir}>
        <PageHeader dir={dir} title={billing.title} description={billing.subtitle} />
        <TrialStatusCard access={memberAccess} isArabic={isArabic} canSubscribe={false} />
        <div className="card p-6 text-sm" style={{ color: "var(--muted)" }}>
          {billing.adminOnly}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-w-0 space-y-4" dir={dir}>
        <PageHeader dir={dir} title={billing.title} description={billing.subtitle} />
        <div className="card p-6">
          <h2 className="mb-2 text-xl font-black">{billing.unavailableTitle}</h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {loadError ?? billing.unavailableDescription}
          </p>
        </div>
      </div>
    );
  }

  const view = billingView({
    accessState: data.access?.state,
    paymentFailed: data.access?.paymentFailed,
    subscriptionStatus: data.subscription?.status,
  });
  const subscription = data.subscription;
  const paidPlan = view === "active" || view === "past_due" ? subscription?.plan ?? null : null;
  const currentCycle: CheckoutCycle | null = paidPlan ? (subscription?.interval === "YEARLY" ? "yearly" : "monthly") : null;
  const trial = view === "trial" ? trialProgress(data.access?.trialEndsAt ?? data.tenant.trialEndsAt, TRIAL_DAYS) : null;
  const signupPlan = isPlanCode(data.tenant.signupPlanCode) ? data.tenant.signupPlanCode : null;
  const recommended = view === "trial" && signupPlan ? signupPlan : "PRO";

  const plans: PlanCardData[] = data.availablePlans.map((plan) => ({
    code: plan.code,
    name: plan.name,
    subtitle: plan.subtitle ?? null,
    description: plan.description ?? null,
    monthly: plan.priceMonthly.formatted,
    yearly: plan.priceYearly.formatted,
    purchasable: plan.purchasable ?? { monthly: true, yearly: true },
  }));
  // The yearly option exists only when every plan has a yearly product.
  const yearlyAvailable = plans.length > 0 && plans.every((plan) => plan.purchasable.yearly);
  const shownCycle: CheckoutCycle = yearlyAvailable ? cycle : "monthly";
  // Entrance order: header, status card, (usage when it comes first), plans.
  const usageFirst = view === "active" || view === "past_due";
  const plansIndex = usageFirst ? 3 : 2;

  return (
    // Not the shared .stagger (0.15s budget): this page has its own,
    // longer entrance (src/components/billing/billing-motion.ts).
    <div className="min-w-0 flex flex-col gap-5" dir={dir}>
      <motion.div {...entrance(0, reduceMotion)}>
        <PageHeader dir={dir} title={billing.title} description={billing.subtitle} />
      </motion.div>

      {notice && (
        <CheckoutStatus
          copy={copy}
          notice={notice}
          onDismiss={() => setNotice(null)}
          onCheckAgain={() => {
            const pending = pendingCheckoutRef.current;
            void confirmActivation(pending?.checkoutId ?? null, pending?.planName ?? "");
          }}
        />
      )}

      <motion.div {...entrance(1, reduceMotion)} className="empty:hidden">
      {successPlan !== null ? (
        <SubscriptionSuccess copy={copy} planName={successPlan} onDashboard={() => router.push("/dashboard")} />
      ) : view === "trial" && trial ? (
        <TrialBanner
          copy={copy}
          daysLeft={trial.daysLeft}
          elapsed={trial.elapsed}
          totalDays={TRIAL_DAYS}
          rtl={isArabic}
          onChoose={scrollToPlans}
        />
      ) : view === "active" && subscription ? (
        <ActiveSubscriptionCard
          copy={copy}
          planName={subscription.plan.name}
          cycleLabel={subscription.interval === "YEARLY" ? copy.yearly : copy.monthly}
          // The plan price for its cycle (USD): the row amount can be 0 for an
          // office an admin put on a plan without Polar.
          price={subscription.interval === "YEARLY" ? subscription.plan.priceYearly.formatted : subscription.plan.priceMonthly.formatted}
          periodEnd={formatDate(subscription.currentPeriodEnd, locale)}
          cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
          managing={portalOpening}
          onManage={() => void openPortal()}
        />
      ) : view === "past_due" ? (
        <PastDueNotice copy={copy} opening={portalOpening} onUpdate={() => void openPortal()} />
      ) : view === "expired" ? (
        <ExpiredNotice copy={copy} onRenew={scrollToPlans} />
      ) : null}
      </motion.div>

      <motion.section
        {...(usageFirst ? entrance(2, reduceMotion) : revealOnScroll(reduceMotion))}
        className="rounded-2xl border p-4 sm:p-5"
        // Paying offices see their usage first; on trial or expired, the
        // plans come first and the usage moves to the end of the page.
        style={{
          background: "var(--card)",
          borderColor: "var(--border)",
          order: usageFirst ? 0 : 1,
        }}
        data-testid="usage"
      >
        <h2 className="mb-4 text-lg font-black" style={{ color: "var(--text)" }}>
          {billing.currentUsage}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(Object.keys(data.usage) as Array<keyof BillingData["usage"]>).map((key) => {
            const item = data.usage[key];
            const percent = Math.min(item.percent ?? 0, 100);
            const tone = percent >= 90 ? "red" : percent >= 75 ? "amber" : "green";
            return (
              <div key={key} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--card-2)" }}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-bold" style={{ color: "var(--text)" }}>
                    {usageLabels[key]}
                  </span>
                  <bdi dir="ltr" className="text-xs font-bold" style={{ color: "var(--muted)" }}>
                    {item.used.toLocaleString("en-US")} / {formatLimit(item.limit, locale)}
                  </bdi>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: item.limit !== null ? `${percent}%` : "0%", background: `var(--tone-${tone}-solid)` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </motion.section>

      <section id="billing-plans" className="scroll-mt-28 space-y-5">
        <motion.div
          {...entrance(plansIndex, reduceMotion)}
          className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <h2 className="text-2xl font-black" style={{ color: "var(--text)" }}>
              {copy.plansTitle}
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              {copy.plansSubtitle}
            </p>
          </div>
          {yearlyAvailable && <CycleToggle copy={copy} cycle={shownCycle} onChange={setCycle} />}
        </motion.div>

        <div className="pt-2">
          <PlanCards
            copy={copy}
            plans={plans}
            cycle={shownCycle}
            recommended={recommended}
            currentCode={paidPlan?.code ?? null}
            currentCycle={currentCycle}
            busyKey={busyKey}
            busyLabel={notice?.kind === "opening" ? copy.openingCheckout : null}
            baseDelay={reduceMotion ? 0 : (plansIndex + 1) * BILLING_ENTRANCE.stagger}
            onSelect={(code, selected) => {
              const plan = plans.find((p) => p.code === code);
              void startPurchase(code, plan?.name ?? code, selected);
            }}
          />
        </div>

        <motion.div {...revealOnScroll(reduceMotion)}>
          <TrustRow copy={copy} />
        </motion.div>
      </section>

      <ComparisonTable copy={copy} isArabic={isArabic} recommended={recommended} />
      <BillingFaq copy={copy} isArabic={isArabic} trialDays={TRIAL_DAYS} />
    </div>
  );
}
