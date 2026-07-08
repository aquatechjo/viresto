'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import arLocale from '@fullcalendar/core/locales/ar'
import type { Locale } from '@/lib/i18n'

interface AppointmentsCalendarProps {
  locale: Locale
  events: any[]
  onEventDrop: (info: any) => void | Promise<void>
  onEventResize: (info: any) => void | Promise<void>
  onDateClick: (info: any) => void
  onEventClick: (info: any) => void
}

export default function AppointmentsCalendar({
  locale,
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
        timeZone="local"
        locale={isRtl ? arLocale : 'en'}
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
                left: 'dayGridMonth,timeGridWeek,timeGridDay',
              }
            : {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay',
              }
        }
        buttonText={
          isRtl
            ? {
                today: 'اليوم',
                month: 'شهر',
                week: 'أسبوع',
                day: 'يوم',
              }
            : {
                today: 'Today',
                month: 'Month',
                week: 'Week',
                day: 'Day',
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