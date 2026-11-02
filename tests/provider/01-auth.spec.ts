// تستات الدخول والتسجيل للبروفايدر (Business owner).
// الشاشات: تسجيل الدخول  /sign-in  ،  رمز التحقق  /verify-sign-in-otp  ،  إنشاء حساب  /sign-up  ،  وتسجيل الخروج.
// User stories: Provider Sign-in / OTP / Sign-up / Logout.
// التستات دي بتشتغل من غير سيشن (كأنه مستخدم جديد مش عامل login)، يعني مش بتستخدم .auth/provider.json.
//
// الحساب: الحساب الأساسي لتستات البروفايدر (آخر حساب عمله onboarding – mainProvider()).
// مهم: السيرفر بيسمح بكود OTP واحد كل دقيقة لنفس الرقم ("يرجى الانتظار دقيقة واحدة...")،
// عشان كده كل خطوات الـ OTP (التايمر، الكود الغلط، الكود الصح، الخروج) في تست واحد بطلب كود واحد بس.
import { test, expect } from '../../src/fixtures/provider.fixture';
import { getOtp } from '../../src/config/otp';
import { randomEgyptPhone, qaName } from '../../src/utils/data';
import { mainProvider, dataProvider } from '../../src/fixtures/qaProvider';
import { loginWithOtp } from '../../src/fixtures/login';
import { API_URL } from '../../src/utils/kiwiApi';
import { env } from '../../src/config/env';

// بنفضّي الـ storageState عشان كل تست في الملف يبدأ من غير login.
test.use({ storageState: { cookies: [], origins: [] } });

// مجموعة تسجيل الدخول برقم الموبايل + OTP، وكمان logout وحماية الصفحات.
test.describe('Auth – Sign in with OTP', () => {
  // صفحة الدخول بتفتح وفيها: حقل الرقم + زرار تسجيل الدخول + لينك إنشاء حساب، ومفيش errors.
  test('sign-in page loads with phone field and sign-in button @smoke', async ({ signIn, health }) => {
    await signIn.goto();
    await expect(signIn.phoneInput).toBeVisible();
    await expect(signIn.submit).toBeVisible();
    await expect(signIn.createAccountLink).toBeVisible();
    await health.expectHealthy();
  });

  // الضغط على دخول والرقم فاضي: المتوقع إنه ميبعتش OTP ويفضل على صفحة sign-in.
  test('empty phone cannot request OTP', async ({ signIn, page }) => {
    await signIn.goto();
    await signIn.submit.click();
    await page.waitForTimeout(2_000);
    await expect(page).toHaveURL(/sign-in/);
  });

  // حروف ورموز في حقل الرقم: المتوقع الحقل يرفضها (ماتتكتبش) أو الدخول يرفضها برسالة "رقم هاتف صالح"،
  // وفي الحالتين مانروحش على شاشة الـ OTP.
  test('letters are not accepted as a phone number', async ({ signIn, page }) => {
    await signIn.goto();
    await signIn.phoneInput.pressSequentially('abc!@#');
    const value = await signIn.phoneInput.inputValue();
    if (/[a-z!@#]/i.test(value)) {
      await signIn.submit.click();
      await expect(page.getByText(/رقم هاتف صالح|رقم الهاتف/).first()).toBeVisible();
    }
    await page.waitForTimeout(2_000);
    await expect(page).not.toHaveURL(/verify-sign-in-otp/);
  });

  // رحلة الـ OTP كاملة بطلب كود واحد:
  //   شاشة الكود فيها الرقم + عداد "(.. ث)" + "إعادة إرسال"
  //   ← كود غلط 1234 = "رمز التحقق غير صالح" ومانخرجش من الشاشة
  //   ← الكود الصح (9999) بعدها يدخل لوحة التحكم
  //   ← تسجيل الخروج من "إعدادات النشاط التجاري" يرجّع لـ sign-in، وفتح /dashboard بعدها يرجّع لـ sign-in
  test('OTP: timer → wrong code rejected → correct code logs in → logout ends session @smoke', async ({
    signIn,
    otp,
    dashboard,
    page,
    health,
  }) => {
    test.setTimeout(4 * 60_000);
    const who = mainProvider();
    await signIn.goto();
    await signIn.requestOtp(who.phone, who.country);
    await expect(otp.boxes.first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('body')).toContainText(who.phone.slice(-4));
    await expect(page.getByText(/\((\d|[٠-٩])+\s*ث\)/).first()).toBeVisible();
    await expect(otp.resend).toBeVisible();

    await otp.enter('1234');
    await expect(otp.invalidOtpMessage).toBeVisible();
    await expect(page).toHaveURL(/verify-sign-in-otp/);

    await otp.boxes.first().fill('');
    await otp.enter(await getOtp(page, who.phone));
    await expect(page).not.toHaveURL(/sign-in|verify-/, { timeout: 30_000 });
    await health.expectHealthy();

    await dashboard.logout();
    await page.goto('/ar/dashboard');
    await expect(page).toHaveURL(/sign-in/, { timeout: 30_000 });
  });

  // طلب كود تاني لنفس الرقم قبل ما الدقيقة تخلص: المتوقع "يرجى الانتظار دقيقة واحدة على الأقل..." ونفضل على sign-in.
  // (بنطلب كود، ونرجع على طول بـ "رجوع" ونطلب تاني في نفس الثواني)
  test('a second OTP request within a minute is throttled', async ({ signIn, otp, page }) => {
    test.setTimeout(3 * 60_000);
    const who = mainProvider();
    await signIn.goto();
    await signIn.requestOtp(who.phone, who.country);
    await expect(otp.boxes.first()).toBeVisible({ timeout: 30_000 });
    await signIn.goto();
    await signIn.selectCountry(who.country);
    await signIn.phoneInput.fill(who.phone);
    await signIn.submit.click();
    await expect(signIn.otpWaitMessage).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/sign-in/);
  });

  // (BUG M11) تسجيل الخروج لازم يلغي التوكن على السيرفر، فأي طلب API بالتوكن القديم يرجع 401.
  // الحالي: بعد الخروج التوكن القديم لسه شغال (200) – الخروج بيمسح الكوكي من المتصفح بس.
  // بيعمل login بنفس الحساب في context لوحده (التوكنات مستقلة، فمش بيأثر على سيشن باقي التستات).
  test('logout revokes the token on the server (BUG M11: old token still works)', async ({
    page,
    dashboard,
  }) => {
    test.setTimeout(3 * 60_000);
    test.fail(true, 'known bug M11: logout does not revoke the token server-side');
    test.info().annotations.push({ type: 'known bug M11', description: 'Logout does not revoke the token' });
    const who = dataProvider();
    await loginWithOtp(page, who.phone, who.country);
    const token = decodeURIComponent(
      (await page.context().cookies()).find((c) => c.name === 'token')?.value ?? '',
    );
    expect(token, 'token cookie after login').not.toBe('');
    await dashboard.logout();
    const res = await page.request.get(`${API_URL}/provider/profile/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    expect(res.status(), 'old token after logout').toBe(401);
  });

  // لينك "إنشاء حساب" لازم يودّي لـ /sign-up على نفس موقع البروفايدر (مش موقع العميل).
  test('sign-up link stays in the business-owner site', async ({ signIn, page }) => {
    await signIn.goto();
    await signIn.createAccountLink.click();
    await expect(page).toHaveURL(/sign-up/);
    await expect(page).toHaveURL(new RegExp(env.provider.baseURL.replace(/https?:\/\//, '')));
  });

  // فتح صفحة محمية (/ar/profile) من غير login: المتوقع تحويل لصفحة sign-in.
  test('protected page redirects to sign-in when logged out', async ({ page }) => {
    await page.goto('/ar/profile');
    await expect(page).toHaveURL(/sign-in/, { timeout: 30_000 });
  });
});

// مجموعة إنشاء حساب بروفايدر جديد  /sign-up (الرحلة الكاملة في tests/onboarding).
test.describe('Auth – Sign up', () => {
  // إرسال الفورم فاضي: المتوقع يفضل على sign-up ويظهر "مطلوب" تحت الحقول.
  test('sign-up form validates required fields', async ({ signUp, page }) => {
    await signUp.goto();
    await signUp.submit.click();
    await expect(page).toHaveURL(/sign-up/);
    await expect(page.getByText(/مطلوب/).first()).toBeVisible();
  });

  // إيميل غلط (not-an-email): خانة الإيميل type="email" فالمتصفح نفسه بيمنع الإرسال ويطلع الـ helper بتاعه.
  // بنتأكد من حالة الخانة: validity.valid = false + validationMessage مش فاضية + مانروحش على رمز التحقق.
  test('sign-up blocks an invalid email (browser email helper)', async ({ signUp, page }) => {
    await signUp.goto();
    await signUp.firstName.fill(qaName('Auto'));
    await signUp.lastName.fill('Provider');
    await signUp.phone.fill(randomEgyptPhone());
    await signUp.email.fill('not-an-email');
    await signUp.submit.click();
    await expect(signUp.email).toHaveAttribute('type', 'email');
    const state = await signUp.email.evaluate((el) => {
      const input = el as HTMLInputElement;
      return { valid: input.validity.valid, message: input.validationMessage };
    });
    expect(state.valid, 'browser marks "not-an-email" as invalid').toBe(false);
    expect(state.message, 'browser helper message').not.toBe('');
    await page.waitForTimeout(2_000);
    await expect(page).not.toHaveURL(/verify-sign-up-otp/);
  });
});
