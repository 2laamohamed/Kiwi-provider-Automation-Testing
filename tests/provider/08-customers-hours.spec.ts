// تستات العملاء والشكاوى وساعات العمل واكتمال الحساب.
// الشاشات: العملاء  /customers  ،  الشكاوى  /complaints  ،  ساعات العمل  /branches-working-hours
// ،  وبانر "أكمل إعداد نشاطك" في الرئيسية  /dashboard?tab=home
// User stories: Customers, Complaints, Branch working hours, Profile completion.
// قرار المنتج: المنتجات والخدمات مش مطلوبة عشان الحساب يبقى مكتمل.
// الحساب: حساب onboarding (مفيهوش عملاء ولا شكاوى لسه – الصفحات بتتأكد إنها بتفتح سليمة).
import { test, expect } from '../../src/fixtures/provider.fixture';
import { AR } from '../../src/utils/texts';
import { expectNoRawI18nKeys, expectNoNullText } from '../../src/utils/pageHealth';
import { kiwiApi } from '../../src/utils/kiwiApi';

// مجموعة تستات العملاء والشكاوى.
test.describe('Customers & complaints', () => {
  // صفحة العملاء بتفتح من غير أي "null" أو "nullnull" في الأسماء والأرقام، ومن غير مفاتيح ترجمة خام.
  test('customers page loads – no "null" phones/names @smoke', async ({ customers, page, health }) => {
    await customers.goto();
    await expectNoNullText(page);
    await expect(page.getByText(/nullnull|null null/)).toHaveCount(0);
    await expectNoRawI18nKeys(page);
    await health.expectHealthy();
  });

  // صفحة الشكاوى بتفتح من غير null ولا errors.
  test('complaints page loads', async ({ complaints, page, health }) => {
    await complaints.goto();
    await expectNoNullText(page);
    await health.expectHealthy();
  });
});

// مجموعة تستات ساعات عمل الفرع.
test.describe('Working hours', () => {
  // الصفحة بتفتح وزرار "تعديل ساعات العمل" ظاهر.
  test('working hours page loads @smoke', async ({ workingHours, health }) => {
    await workingHours.goto();
    await expect(workingHours.page.getByText(AR.workingHours.edit).first()).toBeVisible();
    await health.expectHealthy();
  });

  // كل يوم مفتوح لازم وقت القفل يبقى بعد وقت الفتح. لو فيه يوم غلط التست بيكتب اسمه.
  test('every open day closes after it opens', async ({ workingHours }) => {
    await workingHours.goto();
    const days = await workingHours.readDays();
    const bad = days.filter((d) => !d.closed && d.from !== undefined && d.to !== undefined && d.to <= d.from);
    expect(bad, `Days with close ≤ open: ${bad.map((d) => d.day).join(', ')}`).toEqual([]);
  });

  // الـ 7 أيام كلهم لازم يظهروا في الصفحة (مفيش يوم ناقص).
  test('all 7 days are listed', async ({ workingHours }) => {
    await workingHours.goto();
    const days = await workingHours.readDays();
    const missing = days.filter((d) => !d.raw);
    expect(missing.map((d) => d.day)).toEqual([]);
  });
});

// اكتمال الحساب: onboarding بيكمّل الحساب (صورة + إيميل + خدمات + عمال)، فالمتوقع مفيش بانر "أكمل ملفك الشخصي"
// والـ API بيقول إن الملف والنشاط مكتملين. (قرار المنتج: المنتجات/الخدمات مش شرط لاكتمال الحساب)
test.describe('Profile completion', () => {
  test('completed onboarding account: no completion banner and API says complete', async ({
    dashboard,
    page,
  }) => {
    await dashboard.goto('home');
    await expect(dashboard.upcomingAppointments).toBeVisible({ timeout: 30_000 });
    const api = await kiwiApi(page, 'provider');
    const status = await api.get('/profile/completion-status');
    await api.dispose();
    expect(status.is_complete, 'API: is_complete').toBe(true);
    expect(status.missing_fields, 'API: missing fields').toEqual([]);
    await expect(page.getByText(/أكمل ملفك الشخصي|أكمل إعداد نشاطك/)).toHaveCount(0);
  });
});
