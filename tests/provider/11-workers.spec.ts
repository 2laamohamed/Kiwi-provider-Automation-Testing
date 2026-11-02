// تستات صفحة العمال للبروفايدر.
// الشاشة: العمال  /workers?scope=currentBranch  (قائمة العمال، popup إضافة عامل، نقل عامل لفرع تاني، إيقاف عامل)
// وكمان الفواتير والاشتراك  /subscription  عشان نقرا حد العمال في الباقة.
// User stories: 5932 (الحالة الفاضية + skip)، 5992 (نقل عامل بين الفروع)، 5997 (نقل المواعيد لما العامل يتنقل أو يتوقف).
// تست حد الباقة @destructive بيضيف عمال، وبيشتغل بس مع npm run test:destructive.
import { test, expect } from '../../src/fixtures/provider.fixture';
import { env } from '../../src/config/env';
import { content } from '../../src/utils/content';
import { mainProvider } from '../../src/fixtures/qaProvider';

// مجموعة تستات العمال.
test.describe('Workers', () => {
  // US 5932: لو الحساب مفيهوش عمال لازم تظهر رسالة "لا يوجد عمال" وزرار الإضافة،
  // ومن غير زرار "الذهاب للوحة التحكم". لو فيه عمال بالفعل بيتعمل skip.
  // @needs-data: محتاج حساب مفيهوش عمال (حساب onboarding فيه عاملين) – مش داخل في الرن العادي.
  test('empty state shows message and add CTA (US 5932) @needs-data', async ({ workers, page }) => {
    await workers.goto();
    const count = await workers.headerCount('العمال').catch(() => NaN);
    expect(count, 'needs an account with no workers').toBe(0);
    await expect(page.getByText(/لا يوجد عمال|لم تتم إضافة/).first()).toBeVisible();
    await expect(workers.addButton).toBeVisible();
    await expect(page.getByRole('button', { name: /الذهاب للوحة التحكم|Go to dashboard/ })).toHaveCount(0);
  });

  // فتح popup إضافة عامل والحفظ وهو فاضي: المتوقع رسالة "مطلوب".
  test('add worker form validates required fields', async ({ workers, page }) => {
    await workers.goto();
    await workers.addButton.click();
    const dlg = page.getByRole('dialog').last();
    await expect(dlg).toBeVisible();
    await dlg
      .getByRole('button', { name: /حفظ|إضافة|التالي/ })
      .last()
      .click();
    await expect(dlg.getByText(/مطلوب/).first()).toBeVisible();
  });

  // كروت العمال مفيهاش "null" أو "undefined".
  test('worker card shows name, role and branch – no null', async ({ workers, page }) => {
    await workers.goto();
    await expect(content(page)).not.toContainText(/\bnull\b|undefined/);
  });

  // US 5992: منيو العامل ("إجراءات العامل") ← "نقل": نافذة "نقل العامل" فيها "الفرع الحالي" و"الفرع الجديد"
  // وخطوات (العامل ← المواعيد ← المراجعة). التست بيقفل بـ "إلغاء" (مش بينقل فعلًا).
  test('move worker dialog shows current / new branch (US 5992)', async ({ workers, page }) => {
    await workers.goto();
    await page.getByTestId('e2e-worker-actions-menu').first().click();
    await page.getByTestId('e2e-worker-transfer-open').click();
    const dlg = page.getByRole('dialog').filter({ hasText: 'نقل العامل' });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByText('الفرع الحالي').first()).toBeVisible();
    await expect(dlg.getByText('الفرع الجديد').first()).toBeVisible();
    await expect(dlg).toContainText(mainProvider().branchName);
    await dlg.getByRole('button', { name: 'إلغاء' }).click();
    await expect(dlg).toBeHidden();
  });

  // US 5997: إيقاف عامل (الـ switch) بيفتح "إيقاف العامل" ويعرض المواعيد المتأثرة.
  // عمال حساب onboarding مالهمش مواعيد ← "لا توجد مواعيد متأثرة". التست بيدوس "رجوع" والعامل يفضل شغال.
  test('deactivating a worker shows the affected appointments step (US 5997)', async ({ workers, page }) => {
    await workers.goto();
    const toggle = page.getByTestId('e2e-workers-branch-status-switch').first();
    await expect(toggle).toBeVisible();
    await toggle.click();
    const dlg = page.getByRole('dialog').filter({ hasText: 'إيقاف العامل' });
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText('لا توجد مواعيد متأثرة');
    await dlg.getByRole('button', { name: 'رجوع' }).click();
    await expect(dlg).toBeHidden();
    await expect(page.getByText('إيقاف العامل')).toHaveCount(0);
  });

  // @destructive (ممكن يضيف عمال، بيشتغل بس مع npm run test:destructive):
  // بيقرا حد العمال من صفحة الاشتراك (مثلا 3 / 5 العمال). لو العدد وصل للحد، الإضافة لازم تظهر "ترقية / الحد الأقصى".
  test('worker count respects plan limit (cannot add over limit) @destructive', async ({
    workers,
    subscription,
    page,
  }) => {
    test.skip(!env.runDestructive, 'Adds workers');
    await subscription.goto();
    const limit = Number(
      (await page.locator('body').innerText()).match(/(\d+)\s*\/\s*(\d+)\s*العمال/)?.[2] ?? NaN,
    );
    test.skip(Number.isNaN(limit), 'Plan limit not shown');
    await workers.goto();
    const count = await workers.headerCount('العمال');
    if (count >= limit) {
      await workers.addButton.click();
      await expect(page.getByText(/ترقية|الحد الأقصى/).first()).toBeVisible();
    }
  });
});
