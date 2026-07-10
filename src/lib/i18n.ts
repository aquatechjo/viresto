export type Locale = "ar" | "en";

export const translations = {
  ar: {
    billingPage: {
      title: "الاشتراك والخطة",
      subtitle:
        "راقب خطة المكتب، الحدود، والاستخدام الحالي قبل الترقية أو التوسعة.",
      upgradeRequest: "طلب ترقية الخطة",
      adminOnly: "صفحة الاشتراك متاحة للمدير فقط",
      loadError: "تعذر تحميل بيانات الاشتراك",
      unavailableTitle: "الاشتراك والخطة",
      unavailableDescription: "لا يمكن عرض بيانات الاشتراك لهذا الحساب.",

      currentPlan: "الخطة الحالية",
      office: "المكتب",
      maxUsers: "الحد الأقصى للمستخدمين",
      trialPeriod: "الفترة التجريبية",

      quickSummary: "ملخص سريع",
      invoices: "الفواتير",
      reports: "التقارير",
      aiDocuments: "AI للمستندات",
      support: "الدعم",
      enabled: "مفعلة",
      disabled: "غير مفعلة",

      warning:
        "اقتربت من استهلاك بعض حدود خطتك الحالية. راجع الاستخدام أو اطلب ترقية قبل الوصول للحد الأقصى.",

      currentUsage: "الاستخدام الحالي",
      availablePlans: "الخطط المتاحة",
      bestSeller: "الأكثر مبيعًا",
      currentPlanButton: "خطتك الحالية",
      requestUpgrade: "طلب الترقية",
      changePlanInfo: "حاليًا يتم تعديل الخطة من لوحة إدارة النظام",

      users: "المستخدمون",
      clients: "الموكلون",
      cases: "القضايا",
      documents: "المستندات",
      payments: "المدفوعات",

      used: "مستخدم",
      noLimit: "لا يوجد حد معين",

      noTrial: "لا توجد تجربة محددة",
      unknownTrial: "تاريخ تجربة غير واضح",
      trialEnded: "انتهت الفترة التجريبية",
      trialEndsToday: "تنتهي التجربة اليوم",
      daysLeftPrefix: "متبقي",
      day: "يوم",

      limits: {
        users: "المستخدمون",
        clients: "الموكلون",
        cases: "القضايا",
        documents: "المستندات",
      },

      statuses: {
        ACTIVE: "نشط",
        TRIAL: "تجريبي",
        EXPIRED: "منتهي",
        SUSPENDED: "موقوف",
      },
    },
    common: {
      search: "بحث",
      save: "حفظ",
      cancel: "إلغاء",
      edit: "تعديل",
      delete: "حذف",
      loading: "جاري التحميل...",
      noResults: "لا توجد نتائج",
      back: "رجوع",
      details: "التفاصيل",
      actions: "الإجراءات",
    },

    dashboard: {
      title: "لوحة التحكم",
      appointments: "المواعيد",
      cases: "القضايا",
      clients: "الموكلون",
      documents: "المستندات",
      invoices: "الفواتير",
      payments: "المدفوعات",
      reports: "التقارير",
      settings: "الإعدادات",
      tasks: "المهام",
      activity: "سجل النشاط",
      billing: "الاشتراك والفوترة",
      team: "الفريق",
    },

    sidebar: {
      sections: {
        main: "الرئيسية",
        management: "الإدارة",
        business: "الأعمال",
      },
      nav: {
        dashboard: "لوحة التحكم",
        clients: "الموكلون",
        cases: "القضايا",
        documents: "المستندات",
        appointments: "المواعيد",
        tasks: "المهام",
        team: "الفريق",
        payments: "المدفوعات",
        invoices: "الفواتير",
        reports: "التقارير",
        activity: "سجل النشاط",
        billing: "الاشتراك والخطة",
      },
      roles: {
        ADMIN: "مدير النظام",
        LAWYER: "محامٍ",
        STAFF: "موظف",
      },
      logout: "تسجيل الخروج",
      logoutSuccess: "تم تسجيل الخروج",
      openMenu: "فتح القائمة الجانبية",
    },

    topbar: {
      searchPlaceholder: "بحث في القضايا والموكلين...",
      noResultsFor: "لا نتائج لـ",
    },

    documents: {
      hero: {
        badge: "إدارة الأرشيف القانوني",
        title: "المستندات",
        subtitle:
          "نظّم ملفات المكتب، واربط كل مستند بالموكل أو القضية، مع إمكانية المعاينة والتصنيف والتلخيص الذكي من مكان واحد.",
      },
      planLimit: {
        title: "وصلت إلى حد الخطة الحالية",
        billing: "عرض الاشتراك",
        close: "إغلاق",
      },
      actions: {
        upload: "رفع مستند",
        preview: "معاينة",
        summarizeAi: "تلخيص AI",
        delete: "حذف",
      },
      stats: {
        total: "كل المستندات",
        pdf: "ملفات PDF",
        images: "الصور",
        word: "ملفات Word",
      },
      filters: {
        searchPlaceholder: "ابحث باسم الملف، الموكل، أو القضية...",
        categoryAria: "فلترة حسب التصنيف",
        allCategories: "جميع التصنيفات",
        apply: "بحث",
        clear: "مسح الفلاتر",
        types: {
          all: "الكل",
          pdf: "PDF",
          image: "صور",
          doc: "Word",
        },
      },
      upload: {
        fileAria: "رفع ملف",
        uploading: "جاري رفع الملف...",
        dragDrop: "اسحب الملف هنا أو اضغط للاختيار",
        hint: "PDF, Word, صور — بحد أقصى 10MB",
      },
      linkPanel: {
        title: "بيانات الربط والتصنيف",
        caseAria: "اختيار قضية",
        noCase: "بدون قضية",
        clientAria: "اختيار موكل",
        noClient: "بدون موكل",
        archivedWarning:
          "لا يمكن رفع مستند جديد لأن الربط الحالي يحتوي على موكل مؤرشف.",
        documentCategory: "تصنيف المستند",
        totalSize: "إجمالي حجم الملفات",
      },
      tags: {
        contract: "عقد",
        case: "قضية",
        identity: "هوية",
        judgment: "حكم",
        evidence: "إثبات",
        pleading: "لائحة",
        financial: "مالية",
      },
      empty: {
        title: "لا توجد مستندات",
        first: "ارفع أول مستند لبدء تنظيم أرشيف المكتب.",
        filtered: "لا توجد مستندات مطابقة للفلاتر الحالية.",
      },
      card: {
        client: "الموكل",
        case: "القضية",
        archivedClient: "موكل مؤرشف",
        aiAnalyzed: "تم تحليله بالذكاء الاصطناعي",
      },
      messages: {
        loadError: "فشل تحميل المستندات",
        fileTooLarge: "حجم الملف يتجاوز 10 ميجابايت",
        archivedUploadBlocked: "لا يمكن رفع مستند لموكل مؤرشف",
        planLimitFallback:
          "وصلت إلى حد المستندات أو مساحة التخزين في خطتك الحالية.",
        uploadError: "فشل رفع الملف",
        uploadSuccess: "تم رفع الملف",
        uploadUnexpectedError: "حدث خطأ أثناء رفع الملف",
        openError: "فشل فتح المستند",
        openUnexpectedError: "حدث خطأ أثناء فتح المستند",
        confirmDelete: "هل أنت متأكد من حذف هذا المستند؟",
        deleteError: "فشل حذف الملف",
        deleteSuccess: "تم حذف الملف",
        deleteUnexpectedError: "حدث خطأ أثناء الحذف",
        summarizing: "جاري تلخيص المستند...",
        aiPlanLimitFallback:
          "ميزة تلخيص المستندات بالذكاء الاصطناعي غير متاحة في خطتك الحالية.",
        summarizeError: "تعذر تلخيص المستند",
        summarizeSuccess: "تم تلخيص المستند بنجاح",
        summarizeUnexpectedError: "حدث خطأ أثناء التلخيص",
        archivedDeleteBlocked: "لا يمكن حذف مستند مرتبط بموكل مؤرشف",
      },
    },

    payments: {
      hero: {
        badge: "الإدارة المالية",
        title: "المدفوعات",
        subtitle:
          "تابع أتعاب القضايا، المبالغ المحصلة، المستحقات ونسبة التحصيل لكل قضية من واجهة مالية واضحة تساعدك على مراقبة أداء المكتب.",
      },
      stats: {
        totalFees: "إجمالي الأتعاب",
        collected: "المحصّل",
        due: "المستحق",
        collectionRate: "نسبة التحصيل",
        completedCases: "القضايا المكتملة ماليًا",
        pendingPayments: "مدفوعات معلّقة",
        archivedClientCases: "قضايا موكلين مؤرشفين",
        financialCases: "عدد القضايا المالية",
      },
      filters: {
        searchPlaceholder: "ابحث باسم القضية، رقم القضية أو اسم الموكل...",
        apply: "بحث",
        clear: "مسح الفلاتر",
        chips: {
          all: "الكل",
          paid: "مدفوع جزئيًا",
          pending: "عليه مستحقات",
          completed: "مكتمل ماليًا",
          archived: "موكل مؤرشف",
        },
      },
      empty: {
        title: "لا توجد بيانات مالية",
        noCases: "لا توجد قضايا مرتبطة بمدفوعات حتى الآن.",
        noResults: "لا توجد نتائج مطابقة للفلاتر الحالية.",
      },
      table: {
        title: "تفصيل الأتعاب حسب القضية",
        subtitle: "يعرض الأتعاب، المحصل، المتبقي ونسبة التحصيل لكل قضية",
        count: (count: number) => `${count} قضية`,
        case: "القضية",
        client: "الموكل",
        fees: "الأتعاب",
        collected: "المحصّل",
        due: "المستحق",
        collectionRate: "نسبة التحصيل",
        financialStatus: "الحالة المالية",
      },
      labels: {
        archivedClient: "موكل مؤرشف",
        archivedRecord: "سجل مؤرشف",
        completed: "مكتمل",
        due: "مستحق",
        noPayments: "بدون دفعات",
        unknownClient: "-",
        currency: "د.أ",
      },
    },

    appointments: {
      hero: {
        badge: "التقويم القانوني",
        title: "المواعيد",
        subtitle:
          "تابع الجلسات والاجتماعات والمواعيد النهائية من تقويم واحد، مع ربط كل موعد بالموكل أو القضية لتسهيل متابعة العمل اليومي.",
      },
      actions: {
        newAppointment: "+ موعد جديد",
        saveChanges: "حفظ التعديل",
        close: "إغلاق",
        edit: "تعديل الموعد",
      },
      stats: {
        total: "كل المواعيد",
        today: "مواعيد اليوم",
        sessions: "الجلسات",
        deadlines: "المواعيد النهائية",
      },
      filters: {
        searchPlaceholder: "ابحث في العنوان، المكان، الموكل أو القضية...",
        typeAria: "فلترة حسب نوع الموعد",
        allTypes: "جميع الأنواع",
        apply: "بحث",
        chips: {
          all: "الكل",
          sessions: "جلسات",
          meetings: "اجتماعات",
          calls: "اتصالات",
          deadlines: "مواعيد نهائية",
        },
      },
      upcoming: {
        title: "أقرب المواعيد",
        subtitle: "آخر 5 مواعيد قادمة",
      },
      empty: {
        upcomingTitle: "لا توجد مواعيد قادمة",
        upcomingSub: "لا يوجد مواعيد مجدولة حالياً.",
      },
      labels: {
        archivedClient: "موكل مؤرشف",
      },
      modal: {
        createTitle: "إضافة موعد جديد",
        editTitle: "تعديل الموعد",
      },
      form: {
        title: "عنوان الموعد",
        type: "النوع",
        client: "الموكل",
        noClient: "بدون موكل",
        startTime: "وقت البداية",
        endTime: "وقت الانتهاء",
        location: "المكان",
        locationPlaceholder: "مثلاً: محكمة بداية عمان",
        description: "الوصف",
      },
      details: {
        title: "تفاصيل الموعد",
        date: "التاريخ",
        time: "الوقت",
        client: "الموكل",
        case: "القضية",
        location: "المكان",
      },
      messages: {
        loadError: "فشل تحميل المواعيد",
        requiredTitleTime: "العنوان والوقت مطلوبان",
        archivedEditBlocked: "لا يمكن تعديل موعد مرتبط بموكل مؤرشف",
        archivedCreateBlocked: "لا يمكن إنشاء موعد لموكل مؤرشف",
        archivedDeleteBlocked: "لا يمكن حذف موعد مرتبط بموكل مؤرشف",
        archivedLinkBlocked: "لا يمكن إنشاء أو ربط موعد بموكل مؤرشف.",
        saveError: "حدث خطأ أثناء حفظ الموعد",
        saveUnexpectedError: "حدث خطأ أثناء حفظ الموعد",
        createSuccess: "تمت إضافة الموعد",
        updateSuccess: "تم تعديل الموعد",
        deleteError: "فشل حذف الموعد",
        deleteSuccess: "تم حذف الموعد",
        deleteUnexpectedError: "حدث خطأ أثناء حذف الموعد",
        moveSuccess: "تم تحديث الموعد",
        moveError: "فشل تحديث الموعد",
        resizeSuccess: "تم تحديث مدة الموعد",
        resizeError: "فشل تحديث مدة الموعد",
      },
    },

    team: {
      hero: {
        badge: "إدارة الصلاحيات والمستخدمين",
        title: "الفريق",
        subtitle:
          "أضف أعضاء المكتب، وحدد صلاحيات كل مستخدم، وفعّل أو عطّل الوصول للنظام من مكان واحد واضح وآمن.",
      },
      actions: {
        newMember: "+ عضو جديد",
        addUser: "إضافة المستخدم",
        adding: "جاري الإضافة...",
        activate: "تفعيل",
        deactivate: "تعطيل",
        clearFilters: "مسح الفلاتر",
      },
      stats: {
        total: "كل الأعضاء",
        active: "المفعلون",
        admins: "المدراء",
        inactive: "المعطلون",
      },
      filters: {
        searchPlaceholder: "ابحث باسم المستخدم أو البريد الإلكتروني...",
        roleAria: "فلترة حسب الدور",
        statusAria: "فلترة حسب الحالة",
        allRoles: "جميع الصلاحيات",
        allStatuses: "جميع الحالات",
        apply: "يحث",
        chips: {
          all: "الكل",
          admins: "المدراء",
          lawyers: "المحامون",
          staff: "الموظفون",
        },
      },
      roles: {
        ADMIN: "مدير النظام",
        LAWYER: "محامٍ",
        STAFF: "موظف",
      },
      statuses: {
        active: "مفعل",
        inactive: "معطل",
      },
      form: {
        title: "إضافة مستخدم",
        subtitle: "المستخدم الجديد سيدخل باستخدام البريد وكلمة المرور المؤقتة.",
        namePlaceholder: "الاسم الكامل",
        emailPlaceholder: "البريد الإلكتروني",
        passwordPlaceholder: "كلمة المرور المؤقتة",
        roleAria: "صلاحية المستخدم الجديد",
        hint: "الأفضل استخدام كلمة مرور مؤقتة قوية، ثم مطالبة المستخدم بتغييرها بعد أول دخول.",
      },
      list: {
        title: "أعضاء الفريق",
        resultCount: "مستخدم ضمن النتائج الحالية",
        lawyers: "محامٍ",
        staff: "موظف",
        addedAt: "تاريخ الإضافة",
        changeRoleAria: "تغيير صلاحية المستخدم",
        emptyTitle: "لا يوجد أعضاء",
        emptyFirst: "أضف أول مستخدم للفريق.",
        emptyFiltered: "لا توجد نتائج مطابقة للفلاتر الحالية.",
      },
      unauthorized: {
        title: "إدارة الفريق",
        subtitle: "هذه الصفحة مخصصة لإدارة مستخدمي المكتب وصلاحياتهم.",
        heading: "غير مصرح",
        description: "فقط مدير النظام يستطيع إدارة الفريق.",
      },
      planLimit: {
        title: "وصلت إلى حد الخطة الحالية",
        billing: "عرض الاشتراك",
        close: "إغلاق",
        fallback: "وصلت إلى الحد المسموح من المستخدمين في خطتك الحالية.",
      },
      messages: {
        loadError: "تعذر تحميل الفريق",
        loadUnexpectedError: "حدث خطأ أثناء تحميل الفريق",
        requiredFields: "الاسم والبريد وكلمة المرور مطلوبة",
        addSuccess: "تمت إضافة المستخدم",
        addError: "حدث خطأ أثناء إضافة المستخدم",
        updateSuccess: "تم تحديث المستخدم",
        updateError: "تعذر تحديث المستخدم",
        updateUnexpectedError: "حدث خطأ أثناء تحديث المستخدم",
      },
    },

    cases: {
      title: "القضايا",
      newCase: "قضية جديدة",
      caseNumber: "رقم القضية",
      client: "الموكل",
      status: "الحالة",
      fee: "الأتعاب",
      openClientFile: "عرض ملف الموكل",
      statuses: {
        OPEN: "مفتوحة",
        IN_PROGRESS: "جارية",
        CLOSED: "مغلقة",
        ARCHIVED: "مؤرشفة",
      },
    },

    clients: {
      title: "الموكلون",
      newClient: "موكل جديد",
      name: "الاسم",
      phone: "الهاتف",
      email: "البريد الإلكتروني",
      clientFile: "ملف الموكل",
    },
  },

  en: {
    billingPage: {
      title: "Billing & Subscription",
      subtitle:
        "Monitor your firm plan, limits, and current usage before upgrading or scaling.",
      upgradeRequest: "Request plan upgrade",
      adminOnly: "Billing is available for admins only",
      loadError: "Failed to load billing data",
      unavailableTitle: "Billing & Subscription",
      unavailableDescription:
        "Billing data cannot be displayed for this account.",

      currentPlan: "Current plan",
      office: "Office",
      maxUsers: "Maximum users",
      trialPeriod: "Trial period",

      quickSummary: "Quick summary",
      invoices: "Invoices",
      reports: "Reports",
      aiDocuments: "AI for documents",
      support: "Support",
      enabled: "Enabled",
      disabled: "Disabled",

      warning:
        "You are close to reaching some limits in your current plan. Review usage or request an upgrade before reaching the maximum limit.",

      currentUsage: "Current usage",
      availablePlans: "Available plans",
      bestSeller: "Best seller",
      currentPlanButton: "Current plan",
      requestUpgrade: "Request upgrade",
      changePlanInfo: "Plan changes are currently handled from the admin panel",

      users: "Users",
      clients: "Clients",
      cases: "Cases",
      documents: "Documents",
      payments: "Payments",

      used: "used",
      noLimit: "No fixed limit",

      noTrial: "No trial period",
      unknownTrial: "Unclear trial date",
      trialEnded: "Trial period has ended",
      trialEndsToday: "Trial ends today",
      daysLeftPrefix: "Remaining",
      day: "day",

      limits: {
        users: "Users",
        clients: "Clients",
        cases: "Cases",
        documents: "Documents",
      },

      statuses: {
        ACTIVE: "Active",
        TRIAL: "Trial",
        EXPIRED: "Expired",
        SUSPENDED: "Suspended",
      },
    },
    common: {
      search: "Search",
      save: "Save",
      cancel: "Cancel",
      edit: "Edit",
      delete: "Delete",
      loading: "Loading...",
      noResults: "No results",
      back: "Back",
      details: "Details",
      actions: "Actions",
    },

    dashboard: {
      title: "Dashboard",
      appointments: "Appointments",
      cases: "Cases",
      clients: "Clients",
      documents: "Documents",
      invoices: "Invoices",
      payments: "Payments",
      reports: "Reports",
      settings: "Settings",
      tasks: "Tasks",
      activity: "Activity",
      billing: "Billing",
      team: "Team",
    },

    sidebar: {
      sections: {
        main: "Main",
        management: "Management",
        business: "Business",
      },
      nav: {
        dashboard: "Dashboard",
        clients: "Clients",
        cases: "Cases",
        documents: "Documents",
        appointments: "Appointments",
        tasks: "Tasks",
        team: "Team",
        payments: "Payments",
        invoices: "Invoices",
        reports: "Reports",
        activity: "Activity Log",
        billing: "Billing & Plan",
      },
      roles: {
        ADMIN: "System Admin",
        LAWYER: "Lawyer",
        STAFF: "Staff",
      },
      logout: "Log out",
      logoutSuccess: "Logged out successfully",
      openMenu: "Open sidebar menu",
    },

    topbar: {
      searchPlaceholder: "Search cases and clients...",
      noResultsFor: "No results for",
    },

    documents: {
      hero: {
        badge: "Legal archive management",
        title: "Documents",
        subtitle:
          "Organize office files, link each document to a client or case, preview, classify, and summarize documents with AI from one place.",
      },
      planLimit: {
        title: "You have reached your current plan limit",
        billing: "View subscription",
        close: "Close",
      },
      actions: {
        upload: "Upload document",
        preview: "Preview",
        summarizeAi: "Summarize AI",
        delete: "Delete",
      },
      stats: {
        total: "All documents",
        pdf: "PDF files",
        images: "Images",
        word: "Word files",
      },
      filters: {
        searchPlaceholder: "Search by file name, client, or case...",
        categoryAria: "Filter by category",
        allCategories: "All categories",
        apply: "Filter",
        clear: "Clear filters",
        types: {
          all: "All",
          pdf: "PDF",
          image: "Images",
          doc: "Word",
        },
      },
      upload: {
        fileAria: "Upload file",
        uploading: "Uploading file...",
        dragDrop: "Drag the file here or click to choose",
        hint: "PDF, Word, images — up to 10MB",
      },
      linkPanel: {
        title: "Linking and classification",
        caseAria: "Choose case",
        noCase: "No case",
        clientAria: "Choose client",
        noClient: "No client",
        archivedWarning:
          "A new document cannot be uploaded because the current link contains an archived client.",
        documentCategory: "Document category",
        totalSize: "Total file size",
      },
      tags: {
        contract: "Contract",
        case: "Case",
        identity: "Identity",
        judgment: "Judgment",
        evidence: "Evidence",
        pleading: "Pleading",
        financial: "Financial",
      },
      empty: {
        title: "No documents",
        first:
          "Upload the first document to start organizing the office archive.",
        filtered: "No documents match the current filters.",
      },
      card: {
        client: "Client",
        case: "Case",
        archivedClient: "Archived client",
        aiAnalyzed: "Analyzed by AI",
      },
      messages: {
        loadError: "Failed to load documents",
        fileTooLarge: "The file size exceeds 10MB",
        archivedUploadBlocked:
          "Cannot upload a document for an archived client",
        planLimitFallback:
          "You have reached the document or storage limit in your current plan.",
        uploadError: "Failed to upload file",
        uploadSuccess: "File uploaded",
        uploadUnexpectedError: "An error occurred while uploading the file",
        openError: "Failed to open document",
        openUnexpectedError: "An error occurred while opening the document",
        confirmDelete: "Are you sure you want to delete this document?",
        deleteError: "Failed to delete file",
        deleteSuccess: "File deleted",
        deleteUnexpectedError: "An error occurred while deleting",
        summarizing: "Summarizing document...",
        aiPlanLimitFallback:
          "AI document summarization is not available in your current plan.",
        summarizeError: "Could not summarize document",
        summarizeSuccess: "Document summarized successfully",
        summarizeUnexpectedError: "An error occurred while summarizing",
        archivedDeleteBlocked:
          "Cannot delete a document linked to an archived client",
      },
    },

    payments: {
      hero: {
        badge: "Financial management",
        title: "Payments",
        subtitle:
          "Track case fees, collected amounts, outstanding balances, and collection rates through a clear financial view that helps monitor office performance.",
      },
      stats: {
        totalFees: "Total fees",
        collected: "Collected",
        due: "Outstanding",
        collectionRate: "Collection rate",
        completedCases: "Financially completed cases",
        pendingPayments: "Pending payments",
        archivedClientCases: "Archived-client cases",
        financialCases: "Financial cases",
      },
      filters: {
        searchPlaceholder:
          "Search by case title, case number, or client name...",
        apply: "Filter",
        clear: "Clear filters",
        chips: {
          all: "All",
          paid: "Partially paid",
          pending: "Has outstanding balance",
          completed: "Financially complete",
          archived: "Archived client",
        },
      },
      empty: {
        title: "No financial data",
        noCases: "There are no cases linked to payments yet.",
        noResults: "No results match the current filters.",
      },
      table: {
        title: "Fee breakdown by case",
        subtitle:
          "Shows fees, collected amount, remaining balance, and collection rate for each case",
        count: (count: number) => `${count} ${count === 1 ? "case" : "cases"}`,
        case: "Case",
        client: "Client",
        fees: "Fees",
        collected: "Collected",
        due: "Outstanding",
        collectionRate: "Collection rate",
        financialStatus: "Financial status",
      },
      labels: {
        archivedClient: "Archived client",
        archivedRecord: "Archived record",
        completed: "Complete",
        due: "Due",
        noPayments: "No payments",
        unknownClient: "-",
        currency: "JOD",
      },
    },

    appointments: {
      hero: {
        badge: "Legal calendar",
        title: "Appointments",
        subtitle:
          "Track court sessions, meetings, and deadlines from one calendar, and link each appointment to a client or case to keep daily work organized.",
      },
      actions: {
        newAppointment: "+ New appointment",
        saveChanges: "Save changes",
        close: "Close",
        edit: "Edit appointment",
      },
      stats: {
        total: "All appointments",
        today: "Today's appointments",
        sessions: "Court sessions",
        deadlines: "Deadlines",
      },
      filters: {
        searchPlaceholder: "Search by title, location, client, or case...",
        typeAria: "Filter by appointment type",
        allTypes: "All types",
        apply: "Filter",
        chips: {
          all: "All",
          sessions: "Sessions",
          meetings: "Meetings",
          calls: "Calls",
          deadlines: "Deadlines",
        },
      },
      upcoming: {
        title: "Upcoming appointments",
        subtitle: "Next 5 scheduled appointments",
      },
      empty: {
        upcomingTitle: "No upcoming appointments",
        upcomingSub: "There are no scheduled appointments right now.",
      },
      labels: {
        archivedClient: "Archived client",
      },
      modal: {
        createTitle: "Add new appointment",
        editTitle: "Edit appointment",
      },
      form: {
        title: "Appointment title",
        type: "Type",
        client: "Client",
        noClient: "No client",
        startTime: "Start time",
        endTime: "End time",
        location: "Location",
        locationPlaceholder: "Example: Amman Court of First Instance",
        description: "Description",
      },
      details: {
        title: "Appointment details",
        date: "Date",
        time: "Time",
        client: "Client",
        case: "Case",
        location: "Location",
      },
      messages: {
        loadError: "Failed to load appointments",
        requiredTitleTime: "Title and time are required",
        archivedEditBlocked:
          "Cannot edit an appointment linked to an archived client",
        archivedCreateBlocked:
          "Cannot create an appointment for an archived client",
        archivedDeleteBlocked:
          "Cannot delete an appointment linked to an archived client",
        archivedLinkBlocked:
          "Cannot create or link an appointment to an archived client.",
        saveError: "An error occurred while saving the appointment",
        saveUnexpectedError: "An error occurred while saving the appointment",
        createSuccess: "Appointment added",
        updateSuccess: "Appointment updated",
        deleteError: "Failed to delete appointment",
        deleteSuccess: "Appointment deleted",
        deleteUnexpectedError:
          "An error occurred while deleting the appointment",
        moveSuccess: "Appointment updated",
        moveError: "Failed to update appointment",
        resizeSuccess: "Appointment duration updated",
        resizeError: "Failed to update appointment duration",
      },
    },

    team: {
      hero: {
        badge: "Permissions and users management",
        title: "Team",
        subtitle:
          "Add office members, define each user's permissions, and enable or disable system access from one clear and secure place.",
      },
      actions: {
        newMember: "+ New member",
        addUser: "Add user",
        adding: "Adding...",
        activate: "Activate",
        deactivate: "Deactivate",
        clearFilters: "Clear filters",
      },
      stats: {
        total: "All members",
        active: "Active users",
        admins: "Admins",
        inactive: "Disabled users",
      },
      filters: {
        searchPlaceholder: "Search by user name or email...",
        roleAria: "Filter by role",
        statusAria: "Filter by status",
        allRoles: "All roles",
        allStatuses: "All statuses",
        apply: "Filter",
        chips: {
          all: "All",
          admins: "Admins",
          lawyers: "Lawyers",
          staff: "Staff",
        },
      },
      roles: {
        ADMIN: "System Admin",
        LAWYER: "Lawyer",
        STAFF: "Staff",
      },
      statuses: {
        active: "Active",
        inactive: "Disabled",
      },
      form: {
        title: "Add user",
        subtitle:
          "The new user will sign in using their email and temporary password.",
        namePlaceholder: "Full name",
        emailPlaceholder: "Email address",
        passwordPlaceholder: "Temporary password",
        roleAria: "New user role",
        hint: "Use a strong temporary password, then ask the user to change it after their first sign-in.",
      },
      list: {
        title: "Team members",
        resultCount: "user in the current results",
        lawyers: "lawyer",
        staff: "staff",
        addedAt: "Added at",
        changeRoleAria: "Change user role",
        emptyTitle: "No members",
        emptyFirst: "Add the first user to the team.",
        emptyFiltered: "No results match the current filters.",
      },
      unauthorized: {
        title: "Team management",
        subtitle:
          "This page is dedicated to managing office users and their permissions.",
        heading: "Unauthorized",
        description: "Only the system admin can manage the team.",
      },
      planLimit: {
        title: "You have reached your current plan limit",
        billing: "View subscription",
        close: "Close",
        fallback:
          "You have reached the user limit allowed by your current plan.",
      },
      messages: {
        loadError: "Failed to load the team",
        loadUnexpectedError: "An error occurred while loading the team",
        requiredFields: "Name, email, and password are required",
        addSuccess: "User added",
        addError: "An error occurred while adding the user",
        updateSuccess: "User updated",
        updateError: "Could not update the user",
        updateUnexpectedError: "An error occurred while updating the user",
      },
    },

    cases: {
      title: "Cases",
      newCase: "New Case",
      caseNumber: "Case Number",
      client: "Client",
      status: "Status",
      fee: "Fee",
      openClientFile: "Open client file",
      statuses: {
        OPEN: "Open",
        IN_PROGRESS: "In Progress",
        CLOSED: "Closed",
        ARCHIVED: "Archived",
      },
    },

    clients: {
      title: "Clients",
      newClient: "New Client",
      name: "Name",
      phone: "Phone",
      email: "Email",
      clientFile: "Client File",
    },
  },
} as const;

export function getDirection(locale: Locale) {
  return locale === "ar" ? "rtl" : "ltr";
}

export function getTranslations(locale: Locale) {
  return translations[locale];
}
