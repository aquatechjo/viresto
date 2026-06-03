'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import arLocale from '@fullcalendar/core/locales/ar'

interface AppointmentsCalendarProps {
  events: any[]
  onEventDrop: (info: any) => void | Promise<void>
  onEventResize: (info: any) => void | Promise<void>
  onDateClick: (info: any) => void
  onEventClick: (info: any) => void
}

export default function AppointmentsCalendar({
  events,
  onEventDrop,
  onEventResize,
  onDateClick,
  onEventClick,
}: AppointmentsCalendarProps) {
  return (
    <div className="appointments-calendar">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale={arLocale}
        direction="rtl"
        height="auto"
        selectable
        editable
        nowIndicator
        events={events}
        eventDrop={onEventDrop}
        eventResize={onEventResize}
        dateClick={onDateClick}
        eventClick={onEventClick}
        headerToolbar={{
          right: 'prev,next today',
          center: 'title',
          left: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        buttonText={{
          today: 'اليوم',
          month: 'شهر',
          week: 'أسبوع',
          day: 'يوم',
        }}
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
        moreLinkText={(count) => `+${count} أخرى`}
      />
    </div>
  )
}