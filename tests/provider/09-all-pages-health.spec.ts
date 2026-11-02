// Smoke سريع على كل صفحات البروفايدر: كل صفحة لازم تفتح من غير crash أو 5xx أو مفاتيح ترجمة خام.
// الشاشات: الرئيسية، المواعيد (تقويم وقائمة)، الطلبات، إعدادات النشاط التجاري، إعدادات الحساب  /profile،
// الخدمات  /services، العمال  /workers، منتجات السوق  /products، العملاء  /customers، الشكاوى  /complaints،
// التقارير  /reports، المحفظة  /wallet، الخصومات  /discounts، الفواتير والاشتراك  /subscription،
// اختر خطتك  /pricing، ساعات العمل  /branches-working-hours.
// لو صفحة جديدة اتضافت في الموقع، زوّدي الـ URL بتاعها في ROUTES تحت.
import { test, expect } from '../../src/fixtures/provider.fixture';
import { waitForPageReady, expectNoRawI18nKeys } from '../../src/utils/pageHealth';

// لستة كل صفحات البروفايدر اللي بنعمل عليها health check (كل URL = تست لوحده).
const ROUTES = [
  '/ar/dashboard?tab=home',
  '/ar/dashboard?tab=appointments&mode=calendar',
  '/ar/dashboard?tab=appointments&mode=list',
  '/ar/dashboard?tab=orders&status=all',
  '/ar/dashboard?tab=menu',
  '/ar/profile',
  '/ar/services?scope=currentBranch',
  '/ar/workers?scope=currentBranch',
  '/ar/products?scope=currentBranch',
  '/ar/customers?scope=currentBranch',
  '/ar/complaints?scope=currentBranch',
  '/ar/reports?scope=currentBranch',
  '/ar/wallet?view=transaction&scope=currentBranch',
  '/ar/discounts?scope=currentBranch',
  '/ar/subscription',
  '/ar/pricing',
  '/ar/branches-working-hours',
];

// تست لكل صفحة: تفتح وتخلص تحميل، متحوّلش لـ sign-in (السيشن شغال)، مفيش مفاتيح ترجمة خام ولا errors.
for (const route of ROUTES) {
  test(`page health: ${route} @smoke`, async ({ page, health }) => {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);
    await expect(page).not.toHaveURL(/sign-in/);
    await expectNoRawI18nKeys(page);
    await health.expectHealthy();
  });
}
