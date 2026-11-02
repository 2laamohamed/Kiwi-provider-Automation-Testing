/**
 * Fixtures موقع البروفايدر / الـ Business Owner (staging-web).
 * التستات بتعمل import لـ test من هنا، فبتلاقي كل صفحات الموقع جاهزة:
 * الدخول والتسجيل والـ OTP، البروفايل، الداشبورد، الخدمات/العمال/المنتجات،
 * المواعيد/الطلبات/العملاء/الشكاوى/ساعات العمل، التقارير/المحفظة/الاشتراك/الأسعار/الخصومات.
 * وفيه دالة loginWithOtp لتسجيل الدخول الكامل (رقم → OTP → 2FA).
 */
import { test as base, expect, Page } from '@playwright/test';
import { PageHealth } from '../utils/pageHealth';
import { autoDismissPopups } from '../utils/popups';
import { withStableGoto } from '../utils/stableGoto';
import { SignInPage, OtpPage, SignUpPage } from '../pages/provider/AuthPages';
import { openProviderAs, dataProvider } from './qaProvider';
import { ProfilePage } from '../pages/provider/ProfilePage';
import { DashboardPage } from '../pages/provider/DashboardPage';
import {
  BusinessSettingsPage,
  ServicesPage,
  WorkersPage,
  ProductsPage,
} from '../pages/provider/CatalogPages';
import {
  AppointmentsPage,
  OrdersPage,
  CustomersPage,
  ComplaintsPage,
  WorkingHoursPage,
} from '../pages/provider/OperationsPages';
import {
  ReportsPage,
  WalletPage,
  SubscriptionPage,
  PricingPage,
  DiscountsPage,
} from '../pages/provider/FinancePages';

/** شكل الـ fixtures اللي متاحة في تستات البروفايدر (كل اسم هنا تقدري تطلبيه في التست) */
type ProviderFixtures = {
  health: PageHealth;
  signIn: SignInPage;
  otp: OtpPage;
  signUp: SignUpPage;
  profile: ProfilePage;
  dashboard: DashboardPage;
  businessSettings: BusinessSettingsPage;
  services: ServicesPage;
  workers: WorkersPage;
  products: ProductsPage;
  appointments: AppointmentsPage;
  orders: OrdersPage;
  customers: CustomersPage;
  complaints: ComplaintsPage;
  workingHours: WorkingHoursPage;
  reports: ReportsPage;
  wallet: WalletPage;
  subscription: SubscriptionPage;
  pricing: PricingPage;
  discounts: DiscountsPage;
  /** صفحة داخلة بالحساب الجديد اللي onboarding عمله (في context لوحده) – لتستات المواعيد */
  dataPage: Page;
};

/** الـ test بتاع البروفايدر – فيه كل الـ fixtures اللي تحت جاهزة للاستخدام */
export const test = base.extend<ProviderFixtures>({
  // نفس page العادية بس بتقفل نافذة "تفعيل الإشعارات" لوحدها لو ظهرت
  page: async ({ page }, use) => {
    withStableGoto(page);
    await autoDismissPopups(page);
    await use(page);
  },
  // بيراقب الصفحة: أي crash أو JS error أو API رجّع 5xx
  health: async ({ page }, use) => {
    await use(new PageHealth(page));
  },
  // صفحة تسجيل الدخول /ar/sign-in
  signIn: async ({ page }, use) => use(new SignInPage(page)),
  // شاشة إدخال كود الـ OTP
  otp: async ({ page }, use) => use(new OtpPage(page)),
  // صفحة إنشاء حساب /ar/sign-up
  signUp: async ({ page }, use) => use(new SignUpPage(page)),
  // إعدادات الحساب /ar/profile
  profile: async ({ page }, use) => use(new ProfilePage(page)),
  // الداشبورد /ar/dashboard (الرئيسية والمنيو)
  dashboard: async ({ page }, use) => use(new DashboardPage(page)),
  // إعدادات النشاط التجاري /ar/dashboard?tab=menu
  businessSettings: async ({ page }, use) => use(new BusinessSettingsPage(page)),
  // الخدمات /ar/services
  services: async ({ page }, use) => use(new ServicesPage(page)),
  // العمال /ar/workers
  workers: async ({ page }, use) => use(new WorkersPage(page)),
  // منتجات السوق /ar/products
  products: async ({ page }, use) => use(new ProductsPage(page)),
  // المواعيد /dashboard?tab=appointments
  appointments: async ({ page }, use) => use(new AppointmentsPage(page)),
  // الطلبات /ar/dashboard?tab=orders
  orders: async ({ page }, use) => use(new OrdersPage(page)),
  // العملاء /ar/customers
  customers: async ({ page }, use) => use(new CustomersPage(page)),
  // الشكاوى /ar/complaints
  complaints: async ({ page }, use) => use(new ComplaintsPage(page)),
  // ساعات العمل /ar/branches-working-hours
  workingHours: async ({ page }, use) => use(new WorkingHoursPage(page)),
  // التقارير /ar/reports
  reports: async ({ page }, use) => use(new ReportsPage(page)),
  // المحفظة /ar/wallet
  wallet: async ({ page }, use) => use(new WalletPage(page)),
  // الفواتير والاشتراك /subscription
  subscription: async ({ page }, use) => use(new SubscriptionPage(page)),
  // صفحة الخطط والأسعار /ar/pricing
  pricing: async ({ page }, use) => use(new PricingPage(page)),
  // الخصومات /ar/discounts
  discounts: async ({ page }, use) => use(new DiscountsPage(page)),

  // صفحة داخلة بالحساب الجديد اللي onboarding عمله – لتستات المواعيد
  // الحساب: src/fixtures/qaProvider.ts ← dataProvider() (= آخر حساب عمله onboarding)
  dataPage: async ({ browser }, use) => {
    const page = await openProviderAs(browser, dataProvider());
    await use(page);
    await page.context().close();
  },
});

export { expect };

/** تسجيل الدخول الكامل (رقم → OTP → 2FA) – موجود في login.ts وبيتصدّر من هنا كمان عشان التستات القديمة */
export { loginWithOtp } from './login';
