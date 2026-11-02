// تستات الصفحة الرئيسية والتنقل في موقع البروفايدر.
// الشاشات: الرئيسية  /dashboard?tab=home  ،  تابات الهيدر (المواعيد  ?tab=appointments  ،  الطلبات  ?tab=orders
// ،  إعدادات النشاط التجاري  ?tab=menu)  ،  اختر خطتك  /pricing  ،  وصفحة 404.
// User stories: Dashboard Home, Header navigation, Business-settings menu, i18n/RTL.
// بتتأكد كمان من اتجاه الصفحة (RTL في العربي و LTR في الإنجليزي) ومن عدم ظهور null أو مفاتيح ترجمة خام.
import { test, expect } from '../../src/fixtures/provider.fixture';
import { AR } from '../../src/utils/texts';
import { expectNoRawI18nKeys, expectNoNullText } from '../../src/utils/pageHealth';

// مجموعة تستات الداشبورد والتنقل.
test.describe('Dashboard & navigation', () => {
  // الرئيسية بتظهر كل الأقسام الأساسية، من غير null ولا مفاتيح ترجمة خام ولا errors.
  test('home shows all main sections @smoke', async ({ dashboard, health, page }) => {
    await dashboard.goto('home');
    await dashboard.expectHomeSections();
    await expectNoRawI18nKeys(page);
    await expectNoNullText(page);
    await health.expectHealthy();
  });

  // في العربي لازم <html dir="rtl">.
  test('page direction is RTL in Arabic', async ({ dashboard, page }) => {
    await dashboard.goto('home');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  // تست لكل تاب في الهيدر (المواعيد / الطلبات / إعدادات النشاط التجاري):
  // الضغط على التاب لازم يودّي للـ URL الصح (tab=appointments / tab=orders / tab=menu) والصفحة سليمة.
  for (const tab of ['appointments', 'orders', 'businessSettings'] as const) {
    test(`header tab "${AR.nav[tab]}" navigates correctly`, async ({ dashboard, page, health }) => {
      await dashboard.goto('home');
      await dashboard.navTab(tab).click();
      const expected = {
        appointments: /tab=appointments/,
        orders: /tab=orders/,
        businessSettings: /tab=menu/,
      }[tab];
      await expect(page).toHaveURL(expected);
      await health.expectHealthy();
    });
  }

  // منيو إعدادات النشاط التجاري لازم يعرض: تفاصيل الفرع، ساعات العمل، الخدمات، العمال، منتجات السوق.
  test('business settings menu lists all sections', async ({ businessSettings }) => {
    await businessSettings.goto();
    for (const key of ['branchDetails', 'workingHours', 'services', 'workers', 'products'] as const) {
      await expect(businessSettings.page.getByText(AR.businessSettings[key]).first()).toBeVisible();
    }
  });

  // كارت "الخطة الحالية" في إعدادات النشاط: لينك اختيار الخطة لازم يودّي لصفحة /pricing.
  test('"current plan" card links to pricing', async ({ businessSettings, page }) => {
    await businessSettings.goto();
    await businessSettings.choosePlanLink.click();
    await expect(page).toHaveURL(/pricing/);
  });

  // تغيير اللغة لـ English: المتوقع dir="ltr" ومفيش مفاتيح ترجمة خام. بعدها بيرجّع العربي تاني (rtl).
  test('switching language to English changes direction to LTR', async ({ dashboard, page }) => {
    await dashboard.goto('home');
    await dashboard.languageButton.click();
    await page
      .getByText(/English/)
      .first()
      .click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr', { timeout: 20_000 });
    await expectNoRawI18nKeys(page);
    // رجّع العربي
    await dashboard.languageButton.click();
    await page
      .getByText(/العربية|Arabic/)
      .first()
      .click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl', { timeout: 20_000 });
  });

  // لينك مش موجود: الموقع بيحوّل على الصفحة الرئيسية العامة (صفحة الإطلاق التجريبي) بدل ما يقع (crash).
  test('unknown route redirects to the home page instead of crashing', async ({ page, health }) => {
    await page.goto('/ar/this-page-does-not-exist');
    await expect(page).toHaveURL(/\/$|\/ar\/?$/, { timeout: 30_000 });
    await expect(page.getByText(/كيوي|Kiwi/).first()).toBeVisible();
    await health.expectHealthy();
  });
});
