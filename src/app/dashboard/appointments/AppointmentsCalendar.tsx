'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import arLocale from '@fullcalendar/core/locales/ar'
import type { Locale } from '@/lib/i18n'

const arJoLocale = {
  ...arLocale,
  code: 'ar-JO-u-nu-latn',
}

interface AppointmentsCalendarProps {
  locale: Locale
  timeZone?: string
  events: any[]
  onEventDrop: (info: any) => void | Promise<void>
  onEventResize: (info: any) => void | Promise<void>
  onDateClick: (info: any) => void
  onEventClick: (info: any) => void
}

export default function AppointmentsCalendar({
  locale,
  timeZone = 'Asia/Amman',
  events,
  onEventDrop,
  onEventResize,
  onDateClick,
  onEventClick,
}: AppointmentsCalendarProps) {
  const isRtl = locale === 'ar'

  return (
    <div className="appointments-calendar" dir={isRtl ? 'rtl' : 'ltr'}>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        timeZone={timeZone}
        locale={isRtl ? arJoLocale : 'en'}
        direction={isRtl ? 'rtl' : 'ltr'}
        height="auto"
        selectable
        editable
        nowIndicator
        events={events}
        eventDrop={onEventDrop}
        eventResize={onEventResize}
        dateClick={onDateClick}
        eventClick={onEventClick}
        headerToolbar={
          isRtl
            ? {
                right: 'prev,next today',
                center: 'title',
                left: 'dayGridMonth,timeGridWeek',
              }
            : {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek',
              }
        }
        buttonText={
          isRtl
            ? {
                today: 'اليوم',
                month: 'شهر',
                week: 'أسبوع',
              }
            : {
                today: 'Today',
                month: 'Month',
                week: 'Week',
              }
        }
        eventTimeFormat={{
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }}
        slotLabelFormat={{
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }}
        dayMaxEvents={3}
        moreLinkText={(count) => (isRtl ? `+${count} أخرى` : `+${count} more`)}
      />
    </div>
  )
}