export type Locale = 'ar' | 'en'

export const translations = {
  ar: {
    common: {
      search: 'بحث',
      save: 'حفظ',
      cancel: 'إلغاء',
      edit: 'تعديل',
      delete: 'حذف',
      loading: 'جاري التحميل...',
      noResults: 'لا توجد نتائج',
      back: 'رجوع',
      details: 'التفاصيل',
      actions: 'الإجراءات',
    },

    dashboard: {
      title: 'لوحة التحكم',
      appointments: 'المواعيد',
      cases: 'القضايا',
      clients: 'الموكلون',
      documents: 'المستندات',
      payments: 'المدفوعات',
      reports: 'التقارير المالية',
      settings: 'الملف الشخصي',
      tasks: 'المهام',
      activity: 'النشاطات',
      billing: 'الاشتراك والفواتير',
      team: 'الفريق',
    },

    sidebar: {
  sections: {
    main: 'الرئيسية',
    management: 'الإدارة',
    business: 'الأعمال',
  },
  nav: {
    dashboard: 'لوحة التحكم',
    clients: 'الموكلون',
    cases: 'القضايا',
    documents: 'المستندات',
    appointments: 'المواعيد',
    tasks: 'المهام',
    team: 'الفريق',
    payments: 'المدفوعات',
    invoices: 'الفواتير',
    reports: 'التقارير',
    activity: 'سجل النشاط',
    billing: 'الاشتراك والخطة',
  },
  roles: {
    ADMIN: 'مدير النظام',
    LAWYER: 'محامٍ',
    STAFF: 'موظف',
  },
  logout: 'تسجيل الخروج',
  logoutSuccess: 'تم تسجيل الخروج',
  openMenu: 'فتح القائمة الجانبية',
},

    topbar: {
      searchPlaceholder: 'بحث في القضايا والموكلين...',
      noResultsFor: 'لا نتائج لـ',
    },

    cases: {
      title: 'القضايا',
      newCase: 'قضية جديدة',
      caseNumber: 'رقم القضية',
      client: 'الموكل',
      status: 'الحالة',
      fee: 'الأتعاب',
      openClientFile: 'فتح ملف الموكل',
      statuses: {
        OPEN: 'مفتوحة',
        IN_PROGRESS: 'جارية',
        CLOSED: 'مغلقة',
        ARCHIVED: 'مؤرشفة',
      },
    },

    clients: {
      title: 'الموكلون',
      newClient: 'موكل جديد',
      name: 'الاسم',
      phone: 'الهاتف',
      email: 'البريد الإلكتروني',
      clientFile: 'ملف الموكل',
    },
  },

  en: {
    common: {
      search: 'Search',
      save: 'Save',
      cancel: 'Cancel',
      edit: 'Edit',
      delete: 'Delete',
      loading: 'Loading...',
      noResults: 'No results',
      back: 'Back',
      details: 'Details',
      actions: 'Actions',
    },

    dashboard: {
      title: 'Dashboard',
      appointments: 'Appointments',
      cases: 'Cases',
      clients: 'Clients',
      documents: 'Documents',
      payments: 'Payments',
      reports: 'Financial Reports',
      settings: 'Profile',
      tasks: 'Tasks',
      activity: 'Activity',
      billing: 'Billing & Subscription',
      team: 'Team',
    },

    sidebar: {
  sections: {
    main: 'Main',
    management: 'Management',
    business: 'Business',
  },
  nav: {
    dashboard: 'Dashboard',
    clients: 'Clients',
    cases: 'Cases',
    documents: 'Documents',
    appointments: 'Appointments',
    tasks: 'Tasks',
    team: 'Team',
    payments: 'Payments',
    invoices: 'Invoices',
    reports: 'Reports',
    activity: 'Activity Log',
    billing: 'Billing & Plan',
  },
  roles: {
    ADMIN: 'System Admin',
    LAWYER: 'Lawyer',
    STAFF: 'Staff',
  },
  logout: 'Log out',
  logoutSuccess: 'Logged out successfully',
  openMenu: 'Open sidebar menu',
},

    topbar: {
      searchPlaceholder: 'Search cases and clients...',
      noResultsFor: 'No results for',
    },

    cases: {
      title: 'Cases',
      newCase: 'New Case',
      caseNumber: 'Case Number',
      client: 'Client',
      status: 'Status',
      fee: 'Fee',
      openClientFile: 'Open client file',
      statuses: {
        OPEN: 'Open',
        IN_PROGRESS: 'In Progress',
        CLOSED: 'Closed',
        ARCHIVED: 'Archived',
      },
    },

    clients: {
      title: 'Clients',
      newClient: 'New Client',
      name: 'Name',
      phone: 'Phone',
      email: 'Email',
      clientFile: 'Client File',
    },
  },
} as const

export function getDirection(locale: Locale) {
  return locale === 'ar' ? 'rtl' : 'ltr'
}

export function getTranslations(locale: Locale) {
  return translations[locale]
}