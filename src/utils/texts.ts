/**
 * كل النصوص العربية اللي التستات بتعتمد عليها في مكان واحد (موقع البروفايدر أساساً).
 * الـ page objects بتدوّر على الزراير والعناوين بالنصوص دي.
 * لو نص اتغير في الموقع، عدّليه هنا بس وكل التستات هتاخد التعديل.
 */

/**
 * النصوص متقسمة حسب الشاشة: nav (التابات)، auth (الدخول والتسجيل)، profile، businessSettings،
 * scope (الفرع الحالي/جميع الفروع)، services، workers، products، appointments، orders، reports،
 * wallet، subscription، pricing، discounts، customers، complaints، workingHours وغيرهم.
 */
export const AR = {
  nav: {
    home: 'الرئيسية',
    appointments: 'المواعيد',
    orders: 'الطلبات',
    businessSettings: 'إعدادات النشاط التجاري',
  },
  auth: {
    phonePlaceholder: 'أدخل رقم هاتفك',
    signIn: 'تسجيل الدخول',
    createAccount: 'إنشاء حساب',
    otpTitle: 'رمز التحقق',
    invalidOtp: 'رمز التحقق غير صالح',
    resend: 'إعادة إرسال',
    otpWait: 'يرجى الانتظار دقيقة واحدة على الأقل قبل طلب رمز تحقق آخر',
    maybeLater: 'ربما لاحقًا',
    startBusinessSetup: 'ابدأ إعداد نشاطك التجاري',
    logout: 'تسجيل الخروج',
    namePlaceholder: 'أدخل الاسم',
    emailPlaceholder: 'أدخل بريدك الإلكتروني',
  },
  profile: {
    title: 'إعدادات الحساب',
    save: 'حفظ التغييرات',
    successTitle: 'تم تحديث ملفك الشخصي بنجاح',
    back: 'رجوع',
    nameRequired: 'الاسم مطلوب',
    nameMax: 'لا يمكن أن يتجاوز الاسم 50',
    invalidEmail: 'يرجى إدخال عنوان بريد إلكتروني صالح',
    editPhone: 'تعديل',
    changePhoneTitle: 'تغيير رقم الهاتف',
    sendCode: 'إرسال رمز التحقق',
    samePhoneError: 'هذا هو رقم هاتفك الحالي',
    setupAuthenticator: 'تعيين تطبيق المصادقة',
    deleteProfile: 'حذف الملف الشخصي',
  },
  businessSettings: {
    title: 'إعدادات النشاط التجاري',
    currentPlan: 'الخطة الحالية',
    branchDetails: 'تفاصيل الفرع',
    workingHours: 'ساعات العمل',
    equipments: 'المعدات',
    services: 'الخدمات',
    workers: 'العمال',
    products: 'منتجات السوق',
    gallery: 'معرض الفرع',
  },
  scope: {
    current: 'الفرع الحالي',
    all: 'جميع الفروع',
    upgradeNote: 'لعرض جميع الفروع، يرجى ترقية خطتك',
    upgradeCta: 'ترقية الخطة',
  },
  services: {
    add: 'إضافة خدمة للفرع',
    modalTitle: 'إضافة خدمة',
    chooseExisting: 'اختر من المتاح',
    addNew: 'إضافة جديد',
  },
  workers: {
    add: 'إضافة عامل للفرع',
  },
  products: {
    title: 'منتجات السوق',
    add: 'إضافة منتج للفرع',
    modalTitle: 'إضافة منتج جديد',
    lowStock: 'أوشك على النفاد',
    outOfStock: 'نفد المخزون',
    inStock: 'متوفر',
    saveAndBack: 'حفظ والعودة',
    priceError: 'يجب أن يكون السعر أكبر من',
    qtyError: 'يرجى إدخال كمية صالحة',
    imageRequired: 'صورة منتج السوق مطلوبة',
    nameArPlaceholder: 'أدخل اسم منتج السوق بالعربية',
    nameEnPlaceholder: 'أدخل اسم منتج السوق بالإنجليزية',
    pricePlaceholder: 'أدخل السعر',
    stockPlaceholder: 'أدخل المخزون',
  },
  appointments: {
    title: 'المواعيد',
    daily: 'عرض يومي',
    calendar: 'عرض التقويم',
    list: 'عرض القائمة',
    tabs: ['الكل', 'قادم', 'قيد التنفيذ', 'مكتمل', 'ملغي', 'لم يظهر'],
    empty: 'لا توجد مواعيد',
  },
  orders: {
    title: 'الطلبات',
    tabs: ['الكل', 'تم الاستلام', 'قيد التحضير', 'جاهز', 'تم التسليم', 'ملغي'],
    empty: 'لا توجد طلبات',
  },
  reports: {
    title: 'التقارير',
    detailed: 'عرض التقارير التفصيلية',
    weekly: 'أسبوعي',
    monthly: 'شهري',
  },
  wallet: {
    title: 'المحفظة',
    available: 'الرصيد المتاح',
    current: 'الرصيد الحالي',
    transfer: 'طلب التحويل',
  },
  subscription: {
    title: 'الفواتير والاشتراك',
    currentPlan: 'خطتك الحالية',
    allPlans: 'عرض جميع الخطط',
    invoices: 'الفواتير',
    billingInfo: 'معلومات الفوترة',
  },
  pricing: {
    title: 'اختر خطتك',
    monthly: 'شهري',
    yearly: 'سنوي',
    showCompare: 'عرض مقارنة الميزات',
    currentPlanBadge: 'الخطة الحالية',
  },
  discounts: {
    title: 'الخصومات',
    add: 'إضافة خصم جديد',
    modalTitle: 'إضافة خصم جديد',
    next: 'التالي',
    selectBranchError: 'يرجى تحديد فرع واحد على الأقل',
    percentError: 'يجب أن تكون قيمة النسبة المئوية أقل من 100',
    endDateError: 'يجب أن يكون تاريخ النهاية اليوم أو بعده',
  },
  customers: { title: 'العملاء' },
  complaints: { title: 'الشكاوى' },
  workingHours: { titlePrefix: 'ساعات عمل', edit: 'تعديل ساعات العمل', closed: 'مغلق' },
  completion: { title: 'أكمل إعداد نشاطك' },
  generic: {
    appError: 'Application error',
    notFound404: '404',
  },
};

/** أسماء الشهور بالعربي بالترتيب – بنستخدمها نتأكد من محاور الرسوم البيانية (charts) */
export const AR_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];
