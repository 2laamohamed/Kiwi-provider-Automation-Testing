// تستات صفحة الملف الشخصي للبروفايدر.
// الشاشة: إعدادات الحساب  /profile  (الاسم الأول/الأخير، الإيميل، رقم الهاتف، الصورة، تطبيق المصادقة 2FA).
// User stories: Provider Profile – edit name/email/phone/avatar, 2FA.
// كل التستات بتستخدم سيشن الحساب الأساسي (حساب onboarding). رفع الصورة والإيميل متغطيين في onboarding (قسم 7)،
// وتست رفع الصورة هنا @destructive بيشتغل بس مع npm run test:destructive.
// قرار المنتج: الاسم مسموح يقبل أرقام ورموز (مفيش تست عليه).
import * as path from 'path';
import { test, expect } from '../../src/fixtures/provider.fixture';
import { AR } from '../../src/utils/texts';
import { env } from '../../src/config/env';
import { mainProvider } from '../../src/fixtures/qaProvider';
import { expectNoRawI18nKeys } from '../../src/utils/pageHealth';

// مجموعة تستات صفحة إعدادات الحساب.
test.describe('Profile', () => {
  // قبل كل تست: افتح صفحة /profile.
  test.beforeEach(async ({ profile }) => {
    await profile.goto();
  });

  // الصفحة بتفتح والاسم الأول متعبّي من داتا الحساب، وزرار "حفظ التغييرات" ظاهر، ومفيش مفاتيح ترجمة خام.
  test('profile page loads with user data @smoke', async ({ profile, page, health }) => {
    await expect(profile.firstName).not.toHaveValue('');
    await expect(profile.save).toBeVisible();
    await expectNoRawI18nKeys(page);
    await health.expectHealthy();
  });

  // مسح الاسم الأول والحفظ: المتوقع رسالة "الاسم مطلوب".
  test('first name is required', async ({ profile, page }) => {
    await profile.firstName.fill('');
    await profile.save.click();
    await expect(page.getByText(AR.profile.nameRequired).first()).toBeVisible();
  });

  // اسم أطول من 50 حرف: المتوقع يا إما الحقل يمنع الكتابة بعد 50، يا إما تظهر رسالة "لا يمكن أن يتجاوز الاسم 50".
  test('name longer than 50 chars is rejected', async ({ profile, page }) => {
    await profile.firstName.fill('A'.repeat(51));
    await profile.save.click();
    const err = page.getByText(AR.profile.nameMax).first();
    const value = await profile.firstName.inputValue();
    // يا إما الحقل يمنع الكتابة بعد 50، يا إما يظهر error
    if (value.length > 50) {
      await expect(err).toBeVisible();
    } else {
      expect(value.length).toBeLessThanOrEqual(50);
    }
  });

  // إيميل ناقص (wrong@mail – من غير .com): المتوقع رسالة الموقع "يرجى إدخال عنوان بريد إلكتروني صالح".
  test('invalid email shows validation message', async ({ profile, page }) => {
    await profile.email.fill('wrong@mail');
    await profile.save.click();
    await expect(page.getByText(AR.profile.invalidEmail).first()).toBeVisible();
  });

  // "تعديل" رقم الهاتف بيفتح "تغيير رقم الهاتف" على 4 خطوات (تحقق من القديم ← الرمز ← الرقم الجديد ← تحقق منه)
  // والرقم الحالي ظاهر متخبّي (+20 ******آخر 4 أرقام). التست بيقفل بـ "رجوع" ومش بيبعت كود.
  test('change phone: 4-step dialog with the current number masked', async ({ profile, page }) => {
    await profile.editPhone.click();
    const dlg = page.getByRole('dialog').filter({ hasText: AR.profile.changePhoneTitle });
    await expect(dlg).toBeVisible();
    for (const step of ['تحقق من القديم', 'تحقق من الرمز', 'أدخل الرقم الجديد', 'تحقق من الرقم الجديد']) {
      await expect(dlg.getByText(step).first()).toBeVisible();
    }
    await expect(dlg).toContainText(new RegExp(`\\*+${mainProvider().phone.slice(-4)}`));
    await dlg.getByRole('button', { name: 'رجوع' }).click();
    await expect(dlg).toBeHidden();
  });

  // "تعيين تطبيق المصادقة" (2FA): أول خطوة بتطلب رمز من واتساب (4 أرقام) قبل ما يظهر QR.
  // التست بيقفل بـ "رجوع" (مش بيفعّل 2FA عشان الدخول بالـ 9999 يفضل شغال).
  test('2FA setup starts with a WhatsApp code step', async ({ profile, page }) => {
    await profile.setupAuthenticator.click();
    const dlg = page.getByRole('dialog').filter({ hasText: 'تفعيل المصادقة' });
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText(/واتساب/);
    await expect(dlg.getByRole('button', { name: 'متابعة' })).toBeVisible();
    await dlg.getByRole('button', { name: 'رجوع' }).click();
    await expect(dlg).toBeHidden();
  });

  // تغيير الاسم الأخير لاسم جديد والحفظ: المتوقع رسالة نجاح والاسم يفضل بعد reload.
  // في الآخر التست بيرجّع الاسم الأصلي تاني عشان الحساب ميتغيرش.
  test('saving a valid name shows success and persists after reload', async ({ profile, page }) => {
    const original = await profile.lastName.inputValue();
    const newName = `QA${Date.now().toString().slice(-4)}`;
    await profile.lastName.fill(newName);
    await profile.save.click();
    await expect(profile.successDialog).toBeVisible();
    await profile.closeSuccess();
    await page.reload();
    await expect(profile.lastName).toHaveValue(newName);
    // رجّع الاسم الأصلي
    await profile.lastName.fill(original || 'Provider');
    await profile.save.click();
    await expect(profile.successDialog).toBeVisible();
  });

  // مرتبط ببج معروف: صورة البروفايدر بتختفي بعد ما تروح صفحة تانية وترجع.
  // @destructive: بيرفع صورة جديدة للحساب، بيشتغل بس مع npm run test:destructive.
  // المتوقع: الصورة نفسها تفضل في البروفايل بعد التنقل، وصورة الهيدر متبقاش فاضية.
  test('uploaded avatar persists after navigating away (BUG: image disappears) @destructive', async ({
    profile,
    page,
    dashboard,
  }) => {
    test.skip(!env.runDestructive, 'Changes the account avatar');
    test
      .info()
      .annotations.push({ type: 'issue', description: 'Provider avatar disappears after navigation' });
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles(path.join(__dirname, '../assets/avatar.png'));
    await profile.save.click();
    await expect(profile.successDialog).toBeVisible();
    await profile.closeSuccess();
    const saved = await profile.avatarSrc();
    expect(saved).not.toBe('');
    await dashboard.goto('home');
    await profile.goto();
    expect(await profile.avatarSrc()).toBe(saved);
    expect(await profile.headerAvatarSrc()).not.toBe('');
  });
});
