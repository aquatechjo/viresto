"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

type SettingsForm = {
  isEnabled: boolean;
  accountHolderName: string;
  cliqEnabled: boolean;
  cliqAlias: string;
  bankTransferEnabled: boolean;
  bankName: string;
  iban: string;
  instructionsAr: string;
  instructionsEn: string;
};

const EMPTY_SETTINGS: SettingsForm = {
  isEnabled: false,
  accountHolderName: "",
  cliqEnabled: false,
  cliqAlias: "",
  bankTransferEnabled: false,
  bankName: "",
  iban: "",
  instructionsAr: "",
  instructionsEn: "",
};

export default function ManualPaymentSettingsPanel() {
  const [settings, setSettings] = useState<SettingsForm>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/manual-payment-settings", { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));

        if (!response.ok || !json.success) {
          throw new Error(json.message || "تعذر تحميل إعدادات الدفع");
        }

        const saved = json.data?.settings ?? {};

        setSettings({
          isEnabled: Boolean(saved.isEnabled),
          accountHolderName: saved.accountHolderName ?? "",
          cliqEnabled: Boolean(saved.cliqEnabled),
          cliqAlias: saved.cliqAlias ?? "",
          bankTransferEnabled: Boolean(saved.bankTransferEnabled),
          bankName: saved.bankName ?? "",
          iban: saved.iban ?? "",
          instructionsAr: saved.instructionsAr ?? "",
          instructionsEn: saved.instructionsEn ?? "",
        });
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "تعذر تحميل الإعدادات");
      })
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof SettingsForm>(
    key: K,
    value: SettingsForm[K],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);

    try {
      const response = await fetch("/api/admin/manual-payment-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json.success) {
        toast.error(json.message || "تعذر حفظ معلومات الدفع");
        return;
      }

      toast.success(json.data?.message || "تم حفظ معلومات الدفع");
    } catch {
      toast.error("تعذر الاتصال بالخادم لحفظ معلومات الدفع");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card overflow-hidden p-0">
      <div
        className="flex flex-col gap-4 border-b p-5 xl:flex-row xl:items-start xl:justify-between"
        style={{ borderColor: "var(--border)" }}
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black">إعدادات الدفع اليدوي</h2>
            <span
              className={
                settings.isEnabled ? "badge badge-green" : "badge badge-gray"
              }
            >
              {settings.isEnabled ? "مفعّل للعملاء" : "متوقف"}
            </span>
          </div>

          <p className="mt-1 text-sm" style={{ color: "var(--text-3)" }}>
            أدخل معلومات الحساب وفعّل الطرق التي ستظهر للمكاتب قبل رفع إيصال
            الدفع.
          </p>
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}>
          <input
            type="checkbox"
            checked={settings.isEnabled}
            onChange={(event) => update("isEnabled", event.target.checked)}
            disabled={loading || saving}
            className="h-5 w-5 accent-emerald-700"
          />
          <span className="text-sm font-black">إظهار الدفع اليدوي للعملاء</span>
        </label>
      </div>

      <div className="space-y-5 p-5">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
          ضع فقط معلومات استقبال التحويل مثل اسم المستفيد وIBAN ومعرّف CliQ.
          لا تضع كلمة مرور الحساب أو الرقم السري أو معلومات البطاقة.
        </div>

        <label className="block space-y-1 text-sm">
          <span className="font-bold">اسم صاحب الحساب / المستفيد</span>
          <input
            value={settings.accountHolderName}
            onChange={(event) => update("accountHolderName", event.target.value)}
            disabled={loading || saving}
            className="input"
            placeholder="يُضاف لاحقًا"
            maxLength={150}
          />
        </label>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-[24px] border p-4" style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.cliqEnabled}
                onChange={(event) => update("cliqEnabled", event.target.checked)}
                disabled={loading || saving}
                className="h-5 w-5 accent-emerald-700"
              />
              <span className="font-black">تفعيل CliQ</span>
            </label>

            <label className="mt-4 block space-y-1 text-sm">
              <span className="font-bold">معرّف CliQ</span>
              <input
                value={settings.cliqAlias}
                onChange={(event) => update("cliqAlias", event.target.value)}
                disabled={loading || saving}
                className="input"
                dir="ltr"
                placeholder="يُضاف لاحقًا"
                maxLength={100}
              />
            </label>
          </div>

          <div className="rounded-[24px] border p-4" style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.bankTransferEnabled}
                onChange={(event) =>
                  update("bankTransferEnabled", event.target.checked)
                }
                disabled={loading || saving}
                className="h-5 w-5 accent-emerald-700"
              />
              <span className="font-black">تفعيل التحويل البنكي</span>
            </label>

            <div className="mt-4 grid gap-3">
              <label className="block space-y-1 text-sm">
                <span className="font-bold">اسم البنك</span>
                <input
                  value={settings.bankName}
                  onChange={(event) => update("bankName", event.target.value)}
                  disabled={loading || saving}
                  className="input"
                  placeholder="يُضاف لاحقًا"
                  maxLength={150}
                />
              </label>

              <label className="block space-y-1 text-sm">
                <span className="font-bold">رقم IBAN</span>
                <input
                  value={settings.iban}
                  onChange={(event) => update("iban", event.target.value)}
                  disabled={loading || saving}
                  className="input"
                  dir="ltr"
                  placeholder="يُضاف لاحقًا"
                  maxLength={40}
                  autoComplete="off"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="font-bold">تعليمات إضافية بالعربية</span>
            <textarea
              value={settings.instructionsAr}
              onChange={(event) => update("instructionsAr", event.target.value)}
              disabled={loading || saving}
              className="input min-h-28 resize-y"
              placeholder="مثال: اكتب اسم المكتب في وصف التحويل"
              maxLength={1000}
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-bold">تعليمات إضافية بالإنجليزية</span>
            <textarea
              value={settings.instructionsEn}
              onChange={(event) => update("instructionsEn", event.target.value)}
              disabled={loading || saving}
              className="input min-h-28 resize-y"
              dir="ltr"
              placeholder="Optional English instructions"
              maxLength={1000}
            />
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={loading || saving}
            className="btn btn-primary"
          >
            {saving ? "جاري الحفظ..." : "حفظ إعدادات الدفع"}
          </button>
        </div>
      </div>
    </section>
  );
}
