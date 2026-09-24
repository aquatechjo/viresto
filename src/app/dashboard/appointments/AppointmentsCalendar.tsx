"use client";

import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import arLocale from "@fullcalendar/core/locales/ar";
import type { Locale } from "@/lib/i18n";

const arJoLocale = {
  ...arLocale,
  code: "ar-JO-u-nu-latn",
};

const MOBILE_DAY_LETTERS = {
  ar: ["ح", "ن", "ث", "ر", "خ", "ج", "س"],
  en: ["S", "M", "T", "W", "T", "F", "S"],
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isMobile;
}

interface AppointmentsCalendarProps {
  locale: Locale;
  timeZone?: string;
  events: any[];
  onEventDrop: (info: any) => void | Promise<void>;
  onEventResize: (info: any) => void | Promise<void>;
  onDateClick: (info: any) => void;
  onEventClick: (info: any) => void;
  onRangeChange?: (range: { from: string; to: string }) => void;
}

export default function AppointmentsCalendar({
  locale,
  timeZone = "Asia/Amman",
  events,
  onEventDrop,
  onEventResize,
  onDateClick,
  onEventClick,
  onRangeChange,
}: AppointmentsCalendarProps) {
  const isRtl = locale === "ar";
  const isMobile = useIsMobile();
  const dayLetters = MOBILE_DAY_LETTERS[isRtl ? "ar" : "en"];

  return (
    <div className="appointments-calendar" dir={isRtl ? "rtl" : "ltr"}>
      <FullCalendar
        key={isMobile ? "mobile" : "desktop"}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        timeZone={timeZone}
        locale={isRtl ? arJoLocale : "en"}
        direction={isRtl ? "rtl" : "ltr"}
        height="auto"
        selectable
        editable
        nowIndicator
        events={events}
        eventDrop={onEventDrop}
        eventResize={onEventResize}
        dateClick={onDateClick}
        eventClick={onEventClick}
        datesSet={(info) =>
          onRangeChange?.({
            from: info.start.toISOString(),
            to: info.end.toISOString(),
          })
        }
        dayHeaderContent={
          isMobile
            ? (info) => dayLetters[info.date.getDay()]
            : undefined
        }
        eventMinHeight={isMobile ? 8 : 34}
        eventShortHeight={isMobile ? 8 : 34}
        eventDisplay={isMobile ? "list-item" : "auto"}
        eventContent={
          isMobile
            ? (info) => (
                <span
                  className="appointment-event-dot"
                  title={info.event.title}
                  aria-label={info.event.title}
                />
              )
            : (info) => (
                <div
                  className="appointment-event-content"
                  dir={isRtl ? "rtl" : "ltr"}
                >
                  {info.timeText && (
                    <span className="appointment-event-time" dir="ltr">
                      {info.timeText}
                    </span>
                  )}
                  <span className="appointment-event-title">
                    {info.event.title}
                  </span>
                </div>
              )
        }
        dayMaxEvents={isMobile ? 4 : 3}
        headerToolbar={
          isRtl
            ? {
                right: "prev,next today",
                center: "title",
                left: "dayGridMonth,timeGridWeek",
              }
            : {
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek",
              }
        }
        buttonText={
          isRtl
            ? {
                today: "اليوم",
                month: "شهر",
                week: "أسبوع",
              }
            : {
                today: "Today",
                month: "Month",
                week: "Week",
              }
        }
        eventTimeFormat={{
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          meridiem: "short",
        }}
        slotLabelFormat={{
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          meridiem: "short",
        }}
        moreLinkText={(count) => (isRtl ? `+${count} أخرى` : `+${count} more`)}
      />

      <style jsx global>{`
        .appointments-calendar .fc-scroller {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .appointments-calendar .fc-scroller::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }

        .appointments-calendar .fc-col-header-cell.fc-day-today,
        .appointments-calendar .fc-timegrid-col.fc-day-today,
        .appointments-calendar .fc-daygrid-day.fc-day-today {
          background: var(--green-soft) !important;
        }

        .appointments-calendar
          .fc-col-header-cell.fc-day-today
          .fc-col-header-cell-cushion {
          color: var(--text) !important;
        }

        .appointments-calendar .fc-timegrid-event {
          min-height: 34px;
          overflow: hidden;
          border-radius: 10px;
        }

        .appointments-calendar .fc-timegrid-event .fc-event-main {
          display: flex;
          align-items: center;
          min-height: 32px;
          padding: 4px 7px;
          overflow: hidden;
        }

        .appointments-calendar .appointment-event-content {
          display: flex;
          align-items: center;
          gap: 5px;
          width: 100%;
          min-width: 0;
          font-size: 11px;
          font-weight: 800;
          line-height: 1.25;
          white-space: nowrap;
        }

        .appointments-calendar .appointment-event-time {
          flex: 0 0 auto;
          white-space: nowrap;
        }

        .appointments-calendar .appointment-event-title {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .appointments-calendar .appointment-event-dot {
          display: block;
          width: 6px;
          height: 6px;
          margin: 0 auto;
          border-radius: 9999px;
          background: currentColor;
        }

        .appointments-calendar .fc-daygrid-event-harness {
          display: flex;
          justify-content: center;
        }
      `}</style>
    </div>
  );
}
