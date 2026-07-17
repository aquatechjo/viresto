"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DateTime } from "luxon";

import type { Locale } from "@/lib/i18n";

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  locale: Locale;
  ariaLabel: string;
  timeZone?: string;
  required?: boolean;
  disabled?: boolean;
}

const DEFAULT_TIME_ZONE = "Asia/Amman";

export default function DateTimePicker({
  value,
  onChange,
  locale,
  ariaLabel,
  timeZone = DEFAULT_TIME_ZONE,
  disabled = false,
}: DateTimePickerProps) {
  const isRtl = locale === "ar";
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  const selectedDate = useMemo(() => {
    if (!value) return null;

    const parsed = DateTime.fromFormat(value, "yyyy-MM-dd'T'HH:mm", {
      zone: timeZone,
    });

    return parsed.isValid ? parsed : null;
  }, [timeZone, value]);

  const [viewMonth, setViewMonth] = useState(() =>
    (selectedDate ?? DateTime.now().setZone(timeZone)).startOf("month"),
  );

  const copy =
    locale === "ar"
      ? {
          placeholder: "اختر التاريخ والوقت",
          previousMonth: "الشهر السابق",
          nextMonth: "الشهر التالي",
          today: "اليوم",
          clear: "مسح",
          done: "تم",
          hour: "الساعة",
          minute: "الدقيقة",
          period: "الفترة",
          weekdays: ["أح", "إث", "ث", "أر", "خ", "ج", "س"],
        }
      : {
          placeholder: "Select date and time",
          previousMonth: "Previous month",
          nextMonth: "Next month",
          today: "Today",
          clear: "Clear",
          done: "Done",
          hour: "Hour",
          minute: "Minute",
          period: "Period",
          weekdays: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
        };

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (selectedDate) setViewMonth(selectedDate.startOf("month"));
  }, [selectedDate]);

  const updatePopoverPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const viewportPadding = 12;
    const gap = 8;
    const width = Math.min(360, window.innerWidth - viewportPadding * 2);
    const maxHeight = Math.min(430, window.innerHeight - viewportPadding * 2);
    const availableAbove = rect.top - viewportPadding;
    const availableBelow = window.innerHeight - rect.bottom - viewportPadding;
    const openAbove = availableAbove > availableBelow && availableAbove >= 300;
    const top = openAbove
      ? Math.max(viewportPadding, rect.top - maxHeight - gap)
      : Math.min(
          window.innerHeight - maxHeight - viewportPadding,
          rect.bottom + gap,
        );
    const preferredLeft = isRtl ? rect.right - width : rect.left;
    const left = Math.max(
      viewportPadding,
      Math.min(preferredLeft, window.innerWidth - width - viewportPadding),
    );

    setPopoverStyle({
      position: "fixed",
      top,
      left,
      width,
      maxHeight,
      zIndex: 10000,
    });
  }, [isRtl]);

  useEffect(() => {
    if (!open) return;

    updatePopoverPosition();

    const handleOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
    };
    const handleViewportChange = () => updatePopoverPosition();

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, updatePopoverPosition]);

  const calendarDays = useMemo(() => {
    const monthStart = viewMonth.startOf("month");
    const sundayOffset = monthStart.weekday % 7;
    const gridStart = monthStart.minus({ days: sundayOffset });

    return Array.from({ length: 42 }, (_, index) =>
      gridStart.plus({ days: index }),
    );
  }, [viewMonth]);

  const displayValue = selectedDate
    ? `${selectedDate
        .setLocale(locale === "ar" ? "ar-JO" : "en-US")
        .toLocaleString({
          year: "numeric",
          month: "short",
          day: "numeric",
        })} — ${selectedDate.setLocale("en-US").toLocaleString({
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })}`
    : copy.placeholder;

  function setSelectedDate(date: DateTime) {
    const base = selectedDate ?? DateTime.now().setZone(timeZone);
    const next = date.set({
      hour: selectedDate?.hour ?? base.hour ?? 9,
      minute: selectedDate?.minute ?? 0,
      second: 0,
      millisecond: 0,
    });

    onChange(next.toFormat("yyyy-MM-dd'T'HH:mm"));
  }

  const selectedHour = selectedDate?.hour ?? 9;
  const selectedHour12 = selectedHour % 12 || 12;
  const selectedPeriod = selectedHour >= 12 ? "PM" : "AM";

  function updateTime(part: "hour" | "minute" | "period", rawValue: string) {
    const base =
      selectedDate ??
      DateTime.now().setZone(timeZone).set({ second: 0, millisecond: 0 });
    const currentPeriod = base.hour >= 12 ? "PM" : "AM";
    const next = (() => {
      if (part === "minute") return base.set({ minute: Number(rawValue) });
      if (part === "period") {
        return base.set({
          hour: (base.hour % 12) + (rawValue === "PM" ? 12 : 0),
        });
      }

      return base.set({
        hour:
          (Number(rawValue) % 12) + (currentPeriod === "PM" ? 12 : 0),
      });
    })();

    onChange(next.toFormat("yyyy-MM-dd'T'HH:mm"));
    setViewMonth(next.startOf("month"));
  }

  function selectToday() {
    const now = DateTime.now().setZone(timeZone);
    const next = now.set({
      hour: selectedDate?.hour ?? 9,
      minute: selectedDate?.minute ?? 0,
      second: 0,
      millisecond: 0,
    });

    onChange(next.toFormat("yyyy-MM-dd'T'HH:mm"));
    setViewMonth(next.startOf("month"));
  }

  const popover =
    open && mounted
      ? createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={ariaLabel}
            dir={isRtl ? "rtl" : "ltr"}
            className="hide-scrollbar overflow-auto rounded-3xl border p-4 shadow-2xl"
            style={{
              ...popoverStyle,
              background: "var(--card)",
              borderColor: "var(--border)",
              color: "var(--text)",
              boxShadow: "0 24px 70px rgba(0, 0, 0, 0.32)",
            }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  setViewMonth((current) => current.minus({ months: 1 }))
                }
                className="flex h-10 w-10 items-center justify-center rounded-2xl border text-lg font-black"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--card)",
                }}
                aria-label={copy.previousMonth}
              >
                {isRtl ? "›" : "‹"}
              </button>

              <p className="text-sm font-black">
                {viewMonth
                  .setLocale(locale === "ar" ? "ar-JO" : "en-US")
                  .toFormat("LLLL yyyy")}
              </p>

              <button
                type="button"
                onClick={() =>
                  setViewMonth((current) => current.plus({ months: 1 }))
                }
                className="flex h-10 w-10 items-center justify-center rounded-2xl border text-lg font-black"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--card)",
                }}
                aria-label={copy.nextMonth}
              >
                {isRtl ? "‹" : "›"}
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {copy.weekdays.map((weekday) => (
                <span
                  key={weekday}
                  className="py-1 text-[11px] font-black"
                  style={{ color: "var(--text-3)" }}
                >
                  {weekday}
                </span>
              ))}

              {calendarDays.map((day) => {
                const currentMonth = day.month === viewMonth.month;
                const selected = selectedDate?.toISODate() === day.toISODate();
                const today =
                  day.toISODate() ===
                  DateTime.now().setZone(timeZone).toISODate();

                return (
                  <button
                    key={day.toISODate()}
                    type="button"
                    onClick={() => setSelectedDate(day)}
                    className="flex h-10 items-center justify-center rounded-xl text-sm font-black transition"
                    style={{
                      background: selected
                        ? "var(--sidebar)"
                        : today
                          ? "var(--green-soft)"
                          : "transparent",
                      color: selected
                        ? "#fff"
                        : currentMonth
                          ? "var(--text)"
                          : "var(--text-3)",
                      opacity: currentMonth ? 1 : 0.55,
                      border: today
                        ? "1px solid var(--border)"
                        : "1px solid transparent",
                    }}
                  >
                    {day.day}
                  </button>
                );
              })}
            </div>

            <div
              className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border p-3"
              style={{ borderColor: "var(--border)" }}
            >
              <label className="space-y-1 text-xs font-black">
                <span style={{ color: "var(--text-3)" }}>{copy.hour}</span>
                <select
                  value={String(selectedHour12)}
                  onChange={(event) => updateTime("hour", event.target.value)}
                  className="input h-11"
                  dir="ltr"
                >
                  {Array.from({ length: 12 }, (_, index) => (
                    <option key={index + 1} value={String(index + 1)}>
                      {String(index + 1).padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-xs font-black">
                <span style={{ color: "var(--text-3)" }}>{copy.minute}</span>
                <select
                  value={String(
                    Math.floor((selectedDate?.minute ?? 0) / 5) * 5,
                  ).padStart(2, "0")}
                  onChange={(event) =>
                    updateTime("minute", event.target.value)
                  }
                  className="input h-11"
                  dir="ltr"
                >
                  {Array.from({ length: 12 }, (_, index) => {
                    const minute = String(index * 5).padStart(2, "0");
                    return (
                      <option key={minute} value={minute}>
                        {minute}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="space-y-1 text-xs font-black">
                <span style={{ color: "var(--text-3)" }}>{copy.period}</span>
                <select
                  value={selectedPeriod}
                  onChange={(event) =>
                    updateTime("period", event.target.value)
                  }
                  className="input h-11"
                  dir="ltr"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </label>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="btn btn-ghost flex-1"
              >
                {copy.clear}
              </button>
              <button
                type="button"
                onClick={selectToday}
                className="btn btn-ghost flex-1"
              >
                {copy.today}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-primary flex-1"
              >
                {copy.done}
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setOpen((current) => !current)}
        disabled={disabled}
        className="input flex w-full items-center justify-between gap-3 text-start disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span
          className="truncate"
          style={{ color: selectedDate ? "var(--text)" : "var(--text-3)" }}
        >
          {displayValue}
        </span>
        <span aria-hidden="true" className="shrink-0 text-base">
          📅
        </span>
      </button>
      {popover}
    </>
  );
}
