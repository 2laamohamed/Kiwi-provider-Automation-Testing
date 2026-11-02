// الملف ده بيعمل بروفايدر (Business owner) جديد خالص من الصفر ويتست كل خطوة في الطريق:
//   إنشاء حساب /sign-up ← رمز التحقق (9999) ← "احمِ حسابك" ← "اكتمل التسجيل"
//   ← إعداد المتجر /setup-steps/shop ← إعداد الفرع /setup-steps/branch
//   ← تخصيص الفرع: ساعات العمل / الخدمات / العمال ← لوحة التحكم
//   ← الفواتير والاشتراك /subscription ← خطط الأسعار /pricing ← تأكيد الترقية (من غير دفع)
//   ← إكمال الملف الشخصي /profile (صورة شخصية + إيميل) لحد ما "الملف الشخصي" يختفي من بانر "أكمل إعداد نشاطك"
//   ← داتا للحساب: خدمة وعامل كمان، منتج بصورة، خصم، لوجو وبانر المتجر، وصور معرض الفرع
//     (تستات البروفايدر في tests/provider بتشتغل على الحساب ده وبتلاقي الداتا دي)
//
// كل رن بيعمل حساب جديد برقم عشوائي 1550XXXXXX (اسم المتجر بيبدأ بـ "QA Auto")،
// وبيحفظ السيشن في .auth/provider-new.json وبيانات الحساب في .auth/new-provider.json
// عشان تستات الربط مع الأدمن (tests/integration/06-…) تكمّل على نفس الحساب.
//
// التستات اللي في اسمها (BUG) متعلّمة بـ test.fail() = "متوقع إنها تفشل" عشان البج لسه موجود:
//   - طول ما البج موجود: بتظهر خضرا في التقرير (expected to fail) والرن كله بيبقى نظيف.
//   - لو الديفلوبرز صلّحوا البج: التست هيظهر أحمر "passed unexpectedly" ← ساعتها شيلي سطر test.fail() بتاعه.
// التشغيل: npm run test:onboarding
import { test as base, expect, Page, Browser, Locator } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { env, AUTH_FILES } from '../../src/config/env';
import { randomEgyptPhone, uniqueSuffix, toLatinDigits, parseNumber } from '../../src/utils/data';
import { kiwiApi } from '../../src/utils/kiwiApi';
import {
  SignUpForm,
  SignUpOtp,
  SignUpAfterOtp,
  SetupShopStep,
  SetupBranchStep,
  WorkHoursStep,
  BranchServicesStep,
  BranchWorkersStep,
  WEEK_DAYS,
  NewProvider,
} from '../../src/pages/provider/OnboardingPages';
import { content } from '../../src/utils/content';
import { autoDismissPopups } from '../../src/utils/popups';
import { withStableGoto } from '../../src/utils/stableGoto';
import { ProfilePage } from '../../src/pages/provider/ProfilePage';
import {
  ProductCreator,
  DiscountCreator,
  ShopEditor,
  BranchGallery,
} from '../../src/pages/provider/StoreDataPages';

// بيانات الحساب اللي بنعمله في الرن ده
const SUFFIX = uniqueSuffix();
const PROVIDER: NewProvider = {
  firstName: 'QAAuto',
  lastName: `Provider${SUFFIX}`,
  phone: randomEgyptPhone(),
  country: 'EG',
};
const STORE_NAME = `QA Auto Salon ${SUFFIX}`;
// إيميل تجريبي بيتضاف من صفحة الملف الشخصي (example.com دومين محجوز للتجارب – مفيش إيميلات حقيقية بتتبعت)
const PROFILE_EMAIL = `qa.auto.${SUFFIX}@example.com`;
const BRANCH_NAME = `QA Branch ${SUFFIX}`;
const SERVICE = {
  nameEn: `QA Haircut ${SUFFIX}`,
  nameAr: `قص شعر تجريبي ${SUFFIX}`,
  // مجموعة الخدمات (من الأدمن) – لو اتشالت بيختار أول مجموعة متاحة
  group: 'تسريحات شعر',
  price: '200',
  duration: '30',
  descAr: 'خدمة تجريبية من الأوتوميشن',
  descEn: 'Automation test service',
};

/** بيكتب/بيحدّث ملف بيانات الحساب الجديد (.auth/new-provider.json) */
function saveInfo(extra: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(AUTH_FILES.newProviderInfo), { recursive: true });
  const old = fs.existsSync(AUTH_FILES.newProviderInfo)
    ? JSON.parse(fs.readFileSync(AUTH_FILES.newProviderInfo, 'utf-8'))
    : {};
  fs.writeFileSync(AUTH_FILES.newProviderInfo, JSON.stringify({ ...old, ...extra }, null, 2));
}

/** بيقرأ بيانات الحساب الجديد اللي اتكتبت في الخطوات اللي قبل.
 *  مهم: الأسماء (المتجر/الفرع/الخدمة) بتتقرا من هنا مش من SUFFIX، لأن لو تست فشل Playwright
 *  بيعيد تشغيل الملف في worker جديد و SUFFIX بيتولد من الأول برقم تاني. */
function info(): Record<string, any> {
  if (!fs.existsSync(AUTH_FILES.newProviderInfo)) {
    throw new Error('مفيش بيانات حساب جديد – التست بتاع التسجيل (خطوة 3) لازم ينجح الأول');
  }
  return JSON.parse(fs.readFileSync(AUTH_FILES.newProviderInfo, 'utf-8'));
}

/** رقم الفرع الجديد – لو تست الفرع مانجحش بيقول كده بوضوح بدل ما يفتح صفحة /undefined/ */
function branchId(): number {
  const id = info().branchId;
  if (!id) {
    throw new Error('الفرع لسه ماتعملش – تست "branch step" لازم ينجح الأول');
  }
  return id;
}

/** بيفتح صفحة جديدة داخلة بسيشن الحساب الجديد (اللي اتحفظ بعد التسجيل) */
async function newProviderPage(browser: Browser): Promise<Page> {
  if (!fs.existsSync(AUTH_FILES.newProvider)) {
    throw new Error('مفيش سيشن للحساب الجديد – التست بتاع التسجيل (خطوة 3) لازم ينجح الأول');
  }
  const ctx = await browser.newContext({
    baseURL: env.provider.baseURL,
    storageState: AUTH_FILES.newProvider,
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
    viewport: { width: 1440, height: 900 },
  });
  const page = withStableGoto(await ctx.newPage());
  await autoDismissPopups(page); // نافذة "تفعيل الإشعارات" بتظهر للحسابات الجديدة وبتغطي الصفحة – بتتقفل لوحدها
  return page;
}

/**
 * بانر استكمال البيانات في لوحة التحكم. الموقع بيغيّر العنوان حسب الناقص (اتشاف على staging 02-11):
 *  - ناقص الملف الشخصي بس: "أكمل ملفك الشخصي" + "لم تضف بريدك الإلكتروني. لم تضف صورة شخصية." + زرار "إكمال الملف الشخصي"
 *  - ناقص خدمات / عمال كمان: "أكمل إعداد نشاطك" + "يرجى استكمال: ..." + زرار "عرض الكل"
 */
function completionBanner(page: Page): Locator {
  return page
    .locator('div')
    .filter({ has: page.getByText(/^(أكمل ملفك الشخصي|أكمل إعداد نشاطك)$/) })
    .filter({ has: page.getByRole('button') })
    .last();
}

/** علامة البج في تقرير HTML (بتظهر تحت اسم التست) */
function knownBug(id: string, what: string): void {
  test.info().annotations.push({ type: `known bug ${id}`, description: what });
}

// fixture "page" = نفس صفحة Playwright العادية + قفل نافذة الإشعارات لوحدها
// fixture "np" = صفحة داخلة بالحساب الجديد، وبتتقفل لوحدها بعد التست
const test = base.extend<{ np: Page }>({
  page: async ({ page }, use) => {
    withStableGoto(page);
    await autoDismissPopups(page);
    await use(page);
  },
  np: async ({ browser }, use) => {
    const page = await newProviderPage(browser);
    await use(page);
    // بنحفظ السيشن تاني في الآخر عشان لو اتجدد التوكن
    await page.context().storageState({ path: AUTH_FILES.newProvider });
    await page.context().close();
  },
});

// شاشة إنشاء حساب /sign-up – تستات الـ validation (مش بتعمل حساب)
test.describe('1. Sign-up form validation', () => {
  // كل الخانات فاضية: المتوقع رسايل "مطلوب" للاسم الأول والأخير والتليفون، و"يجب أن توافق على الشروط"
  test('empty submit shows required errors for names, phone and terms', async ({ page }) => {
    const f = new SignUpForm(page);
    await f.goto();
    await f.submit.click();
    await expect(page.getByText('الاسم مطلوب')).toHaveCount(2);
    await expect(page.getByText('رقم الهاتف مطلوب')).toBeVisible();
    await expect(page.getByText('يجب أن توافق على الشروط والأحكام')).toBeVisible();
    await expect(page).toHaveURL(/sign-up$/);
  });

  // رقم قصير (123): المتوقع "رقم الهاتف قصير جداً" ونفضل في صفحة التسجيل
  test('short phone is rejected', async ({ page }) => {
    const f = new SignUpForm(page);
    await f.goto();
    await f.fill({ ...PROVIDER, phone: '123' });
    await f.acceptTerms();
    await f.submit.click();
    await expect(page.getByText(/رقم الهاتف قصير|يرجى إدخال رقم هاتف صالح/).first()).toBeVisible();
    await expect(page).toHaveURL(/sign-up$/);
  });

  // رقم صحيح وإيميل غلط (bad-email): خانة الإيميل type="email"، فالمتصفح نفسه بيمنع الإرسال
  // وبيطلع الـ helper بتاعه (الفقاعة الصغيرة "Please include an '@'…") – مش رسالة من الموقع.
  // الفقاعة دي مش جزء من الصفحة فمينفعش نشوفها بـ getByText، عشان كده بنتأكد من حالة الخانة نفسها:
  //   validity.valid = false  +  validationMessage مش فاضية  +  مانروحش على رمز التحقق
  test('invalid email is blocked by the browser email helper (valid phone)', async ({ page }) => {
    const f = new SignUpForm(page);
    await f.goto();
    await f.fill({ ...PROVIDER, phone: randomEgyptPhone(), email: 'bad-email' });
    await f.acceptTerms();
    await f.submit.click();
    await expect(f.email).toHaveAttribute('type', 'email');
    const state = await f.email.evaluate((el) => {
      const input = el as HTMLInputElement;
      return { valid: input.validity.valid, message: input.validationMessage };
    });
    expect(state.valid, 'browser marks "bad-email" as invalid').toBe(false);
    expect(state.message, 'browser helper message').not.toBe('');
    await page.waitForTimeout(2_000);
    await expect(page, 'should not go to OTP with a bad email').not.toHaveURL(/verify-sign-up-otp/);
  });
});

// التسجيل الحقيقي + رمز التحقق + الشاشات اللي بعده
test.describe('2. Register a brand-new provider', () => {
  // بيسجّل برقم عشوائي: المتوقع يروح على شاشة رمز التحقق والرقم مكتوب فيها،
  // الكود الغلط (1234) يطلع "رمز التحقق غير صالح"، والكود 9999 يدخل على "احمِ حسابك".
  // في الآخر بيحفظ السيشن وبيانات الحساب للتستات اللي بعده.
  test('sign up → wrong OTP rejected → OTP 9999 accepted', async ({ page }) => {
    test.setTimeout(3 * 60_000);
    const f = new SignUpForm(page);
    await f.goto();
    await f.fill(PROVIDER);
    await f.acceptTerms();
    await f.submit.click();
    await expect(page.getByText('رقم الهاتف موجود بالفعل')).toHaveCount(0);

    const otp = new SignUpOtp(page);
    await expect(page).toHaveURL(/verify-sign-up-otp/, { timeout: 30_000 });
    await expect(page.locator('body')).toContainText(`+20${PROVIDER.phone}`);
    await otp.enter('1234');
    await expect(otp.invalid).toBeVisible();
    await otp.input.click();
    await otp.input.press('Control+A');
    await otp.input.press('Backspace');
    await otp.enter();
    await expect(page).toHaveURL(/setup-authenticator/, { timeout: 30_000 });

    fs.mkdirSync(path.dirname(AUTH_FILES.newProvider), { recursive: true });
    await page.context().storageState({ path: AUTH_FILES.newProvider });
    fs.writeFileSync(AUTH_FILES.newProviderInfo, '{}');
    saveInfo({
      ...PROVIDER,
      storeName: STORE_NAME,
      branchName: BRANCH_NAME,
      service: SERVICE,
      profileEmail: PROFILE_EMAIL,
    });
  });

  // "ربما لاحقًا" في شاشة المصادقة ← "اكتمل التسجيل" ← زرار "ابدأ إعداد نشاطك التجاري" ← /setup-steps/shop
  test('skip authenticator → "registration complete" → business setup', async ({ np }) => {
    await np.goto('/sign-up/setup-authenticator');
    await new SignUpAfterOtp(np).skipAuthenticatorAndStart();
  });
});

// إعداد المتجر والفرع
test.describe('3. Store & branch setup', () => {
  // كل الخانات فاضية: المتوقع رسايل مطلوب للاسم والفئة والدولة والوصف بالعربي والإنجليزي
  test('store step: required validation', async ({ np }) => {
    await np.goto('/setup-steps/shop');
    const s = new SetupShopStep(np);
    await s.waitReady();
    await s.next.click();
    for (const msg of [
      'اسم المتجر مطلوب',
      'فئة العمل مطلوبة',
      'الدولة مطلوبة',
      'وصف النشاط باللغة الإنجليزية مطلوب',
      'وصف النشاط باللغة العربية مطلوب',
    ]) {
      await expect(np.getByText(msg)).toBeVisible();
    }
  });

  // بيعمل المتجر (صالون تجميل – مصر) ويتأكد إن الـ API رجّع المتجر بنفس البيانات وحالته "pending" (في انتظار موافقة الأدمن)
  test('store step: create the store (approval = pending)', async ({ np }) => {
    await np.goto('/setup-steps/shop');
    const storeName: string = info().storeName;
    await new SetupShopStep(np).fillAndNext({
      name: storeName,
      category: 'صالون تجميل',
      countryName: /مصر/,
      bioEn: 'QA automation beauty salon',
      bioAr: 'صالون تجميل للاختبار الآلي',
    });
    const api = await kiwiApi(np, 'provider');
    const store = await api.get('/stores');
    await api.dispose();
    expect(store.name).toBe(storeName);
    expect(store.default_currency).toBe('EGP');
    expect(store.approval_status).toBe('pending');
    saveInfo({ storeId: store.id });
  });

  // الفرع: اسم + موقع من الخريطة (بحث "Nasr City Cairo") ← المتوقع يروح على ساعات العمل ونحفظ رقم الفرع
  test('branch step: name + map location → work hours', async ({ np }) => {
    await np.goto('/setup-steps/branch');
    const branchId = await new SetupBranchStep(np).fillAndNext(info().branchName, 'Nasr City Cairo');
    expect(branchId).toBeGreaterThan(0);
    saveInfo({ branchId });
  });
});

// ساعات العمل
test.describe('4. Working hours', () => {
  /** بيفتح شاشة ساعات العمل للفرع الجديد */
  async function openWorkHours(np: Page): Promise<WorkHoursStep> {
    await np.goto(`/setup-steps/branch-customisation/${branchId()}/work-hours`);
    const w = new WorkHoursStep(np);
    await expect(w.radio('fixed-times')).toBeVisible({ timeout: 30_000 });
    return w;
  }

  // كل يوم من 9 الصبح لـ 11 بالليل: المتوقع ينقل على الخدمات، والـ API يرجّع 7 أيام مفتوحة 09:00 – 23:00
  test('every day 09:00 AM – 11:00 PM is saved correctly (checked in the API)', async ({ np }) => {
    const w = await openWorkHours(np);
    await w.setFixedTimes(WEEK_DAYS, '09:00', 'am', '11:00', 'pm');
    await w.next.click();
    await expect(np).toHaveURL(/services/, { timeout: 30_000 });
    const api = await kiwiApi(np, 'provider');
    const hours: Array<{ day: string; start_time: string; end_time: string; is_open: boolean }> =
      await api.get(`/branches/${branchId()}/working-hours`);
    await api.dispose();
    expect(hours).toHaveLength(7);
    for (const h of hours) {
      expect(h.is_open, h.day).toBe(true);
      expect(`${h.start_time}-${h.end_time}`, h.day).toBe('09:00-23:00');
    }
  });
});

// الخدمات والعمال
test.describe('5. Services & workers', () => {
  // نافذة "إضافة خدمة" فاضية: المتوقع رسايل مطلوب لاسم الخدمة (عربي وإنجليزي) والسعر والمدة
  test('add-service dialog: required errors', async ({ np }) => {
    await np.goto(`/setup-steps/branch-customisation/${branchId()}/services`);
    const s = new BranchServicesStep(np);
    await s.addButton.click();
    await s.form.submit.click();
    for (const msg of [
      'اسم الخدمة باللغة الإنجليزية مطلوب',
      'اسم الخدمة باللغة العربية مطلوب',
      'السعر مطلوب',
      'المدة مطلوبة',
    ]) {
      await expect(np.getByText(msg)).toBeVisible();
    }
  });

  // (BUG L4) نفس النافذة: تحت "مجموعة الخدمات" لازم الرسالة تكون "مجموعة الخدمات مطلوبة".
  // الحالي: الرسالة بتقول "فئة العمل مطلوبة" (نص رسالة خانة "فئة العمل" بتاعة إعداد المتجر).
  test('add-service dialog: error under "service group" names the right field (BUG: says "فئة العمل مطلوبة")', async ({
    np,
  }) => {
    test.fail(); // بج معروف L4 – شيلي السطر ده لما يتصلح
    knownBug('L4', 'Wrong validation label under "مجموعة الخدمات" in the add-service dialog');
    await np.goto(`/setup-steps/branch-customisation/${branchId()}/services`);
    const s = new BranchServicesStep(np);
    await s.addButton.click();
    await s.form.submit.click();
    await expect(np.getByText('السعر مطلوب')).toBeVisible();
    await expect(s.form.dialog.getByText(/مجموعة الخدمات مطلوبة/), 'error under service group').toBeVisible({
      timeout: 5_000,
    });
  });

  // سعر بالسالب (-50) ومدة صفر: المتوقع "يجب أن يكون السعر رقمًا صالحًا أكبر من 0" ونفس الكلام للمدة،
  // والعملة جنب السعر L.E (لأن المتجر في مصر)
  test('negative price and zero duration are rejected; currency is L.E', async ({ np }) => {
    await np.goto(`/setup-steps/branch-customisation/${branchId()}/services`);
    const s = new BranchServicesStep(np);
    await s.addButton.click();
    await expect(s.form.currency).toHaveText('L.E');
    await s.form.price.fill('-50');
    await s.form.duration.fill('0');
    await s.form.submit.click();
    await expect(np.getByText('يجب أن يكون السعر رقمًا صالحًا أكبر من 0')).toBeVisible();
    await expect(np.getByText('يجب أن تكون المدة رقمًا صالحًا أكبر من 0')).toBeVisible();
  });

  // بيضيف الخدمة (200 ج.م – 30 دقيقة): المتوقع رسالة نجاح وعدد الخدمات يبقى (1)
  test('add a service → list shows (1)', async ({ np }) => {
    await np.goto(`/setup-steps/branch-customisation/${branchId()}/services`);
    const s = new BranchServicesStep(np);
    await s.add(info().service);
    await expect(s.count).toHaveText('(1)');
  });

  // نافذة "إضافة عامل" فاضية: المتوقع رسايل مطلوب للاسم والتليفون والدور وأيام العمل ووقت البداية والنهاية
  test('add-worker dialog: required errors', async ({ np }) => {
    await np.goto(`/setup-steps/branch-customisation/${branchId()}/workers`);
    const w = new BranchWorkersStep(np);
    await w.addButton.click();
    await w.form.submit.click();
    for (const msg of [
      'الاسم الأول مطلوب',
      'الاسم الأخير مطلوب',
      'رقم الهاتف مطلوب',
      'الدور مطلوب',
      'يرجى اختيار يوم عمل واحد على الأقل',
      'يرجى تحديد وقت البداية',
      'يرجى تحديد وقت النهاية',
    ]) {
      await expect(np.getByText(msg)).toBeVisible();
    }
  });

  // بيضيف عامل "أخصائي / مقدم خدمة" كل يوم 9 ص – 11 م ومربوط بالخدمة: المتوقع رسالة نجاح وعدد العمال (1)
  test('add a specialist worker linked to the service → list shows (1)', async ({ np }) => {
    await np.goto(`/setup-steps/branch-customisation/${branchId()}/workers`);
    const w = new BranchWorkersStep(np);
    await w.add({
      firstName: 'QA',
      lastName: `Worker${SUFFIX}`,
      phone: randomEgyptPhone(),
      country: 'EG',
      role: 'أخصائي / مقدم خدمة',
      from: '09:00',
      fromP: 'am',
      to: '11:00',
      toP: 'pm',
      service: info().service.nameAr,
    });
    await expect(w.count).toHaveText('(1)');
  });

  // "الذهاب إلى لوحة التحكم": المتوقع يفتح /dashboard ويظهر اسم الفرع في الهيدر وبانر "أكمل إعداد نشاطك"
  // اللي بيقول "يرجى استكمال: الملف الشخصي" (الخدمات والعمال اتضافوا، فاللي ناقص الملف الشخصي بس)
  test('finish setup → dashboard with branch name and profile-completion banner', async ({ np }) => {
    await np.goto(`/setup-steps/branch-customisation/${branchId()}/workers`);
    await new BranchWorkersStep(np).finish.click();
    await expect(np).toHaveURL(/dashboard/, { timeout: 30_000 });
    await expect(np.getByTestId('e2e-header-branch-select-trigger')).toContainText(info().branchName);
    await expect(completionBanner(np)).toBeVisible({ timeout: 30_000 });
    // الخدمات والعمال اتضافوا، فالناقص الإيميل والصورة بس
    await expect(completionBanner(np)).toContainText('لم تضف بريدك الإلكتروني');
    await expect(completionBanner(np)).not.toContainText(/الخدمات|العمال/);
  });
});

// الاشتراك والخطط للحساب الجديد
test.describe('6. Subscription & pricing for the new account', () => {
  /** بيفتح /pricing ويستنى كارت الخطة الحالية، ويرجّع عدد الخطط المدفوعة (زراير "ترقية إلى …") */
  async function openPricing(np: Page): Promise<number> {
    await np.goto('/pricing');
    await expect(np.getByText('اختر خطتك')).toBeVisible({ timeout: 30_000 });
    await expect(np.getByRole('button', { name: 'الخطة الحالية' }).first()).toBeVisible({ timeout: 30_000 });
    return content(np)
      .getByRole('button', { name: /^ترقية إلى / })
      .count();
  }

  // الحساب الجديد بياخد الخطة المجانية: "مجاني" "نشط" 0.00 L.E، الفروع 1 من الحد والعمال 1 من الحد،
  // ومفيش فواتير ومفيش زرار "إلغاء الاشتراك"
  test('new account is on the active FREE plan, usage 1 branch / 1 worker, no invoices', async ({ np }) => {
    await np.goto('/subscription');
    await expect(np.getByText('خطتك الحالية')).toBeVisible({ timeout: 30_000 });
    const t = toLatinDigits(await content(np).innerText()).replace(/\n+/g, ' | ');
    expect(t).toMatch(/مجاني/);
    expect(t).toMatch(/نشط/);
    expect(t).toMatch(/0\.00\s*\|\s*L\.E/);
    expect(t).toMatch(/الفروع\s*\|\s*1\s*\/\s*\d+/);
    expect(t).toMatch(/العاملين\s*\|\s*1\s*\/\s*\d+/);
    expect(t).toMatch(/لا توجد فواتير/);
    await expect(np.getByRole('button', { name: 'إلغاء الاشتراك' })).toHaveCount(0);
    const limits = t.match(/الفروع\s*\|\s*1\s*\/\s*(\d+).*?العاملين\s*\|\s*1\s*\/\s*(\d+)/);
    saveInfo({ freeBranchesLimit: Number(limits?.[1]), freeWorkersLimit: Number(limits?.[2]) });
  });

  // /pricing: كارت الخطة المجانية ظاهر وعليه "الحالية" و"الخطة الحالية" وعدد الفروع والعمال.
  // وكل خطة مدفوعة (لو موجودة): ليها سعر شهري (/ شهر) وسعر سنوي (/ سنة) أكبر من 0، وعدد فروع وعدد عمال.
  // قرار المنتج 02-11: الفترة الحالية فيه خطة واحدة بس (المجانية) ومفيش ترقية – فلو مفيش خطط مدفوعة
  // التست بيتأكد من الخطة المجانية بس ويكتب ملاحظة في التقرير.
  // (مفيش قاعدة إن السنوي أرخص من 12 × الشهري – الأسعار بتتحدد من الأدمن)
  test('every paid plan shows a monthly and a yearly price, branches and workers', async ({ np }) => {
    const paid = await openPricing(np);
    const free = content(np)
      .locator('div')
      .filter({ hasText: 'مجاني' })
      .filter({ has: np.getByRole('button', { name: 'الخطة الحالية' }) })
      .last();
    await expect(free).toContainText(/\d+\s*فرع/);
    await expect(free).toContainText(/\d+\s*(عمال|عامل)/);
    if (paid === 0) {
      test.info().annotations.push({
        type: 'free plan only',
        description:
          'No paid plans on /pricing right now (product decision 02-11) – only the free plan was checked',
      });
      return;
    }
    type Card = { name: string; price: number; text: string };
    const readCards = async (cycle: 'شهر' | 'سنة'): Promise<Card[]> => {
      let cards: Card[] = [];
      await expect(async () => {
        cards = [];
        const buttons = content(np).getByRole('button', { name: /^ترقية إلى / });
        for (let i = 0; i < (await buttons.count()); i++) {
          const b = buttons.nth(i);
          const name = (await b.innerText()).replace(/^ترقية إلى\s*/, '').trim();
          // الكارت = أقرب عنصر فوق الزرار فيه "L.E"
          const text = toLatinDigits(await b.locator('xpath=ancestor::*[contains(., "L.E")][1]').innerText());
          const m = text.match(/([\d,.]+)\s*L\.E\s*\/\s*(شهر|سنة)/);
          if (m && m[2] === cycle) {
            cards.push({ name, price: parseNumber(m[1]), text });
          }
        }
        expect(cards.length, `paid plans priced "/ ${cycle}"`).toBeGreaterThan(0);
      }).toPass({ timeout: 20_000 });
      return cards;
    };
    await np.getByRole('button', { name: /^شهري$/ }).click();
    const monthly = await readCards('شهر');
    await np.getByRole('button', { name: /^سنوي/ }).click();
    const yearly = await readCards('سنة');
    for (const c of [...monthly, ...yearly]) {
      expect(c.price, `${c.name} price`).toBeGreaterThan(0);
      expect(c.text, `${c.name} shows branches`).toMatch(/\d+\s*فرع/);
      expect(c.text, `${c.name} shows workers`).toMatch(/\d+\s*(عمال|عامل)/);
    }
    expect(yearly.map((c) => c.name).sort(), 'same paid plans in monthly and yearly').toEqual(
      monthly.map((c) => c.name).sort(),
    );
  });

  // "ترقية إلى احترافي" (شهري) ← صفحة "تأكيد الترقية": الفرق = سعر الخطة الجديدة − الحالية (0)،
  // والسعة الجديدة للفروع والعمال أكبر من الحالية. التست مابيدوسش "تأكيد الترقية" (مفيش دفع).
  // (لو مفيش خطط مدفوعة – قرار المنتج 02-11: خطة مجانية بس – التست بيتعمل skip وسببه بيظهر في آخر الرن)
  test('upgrade summary: difference = new − current; capacity increases (no payment)', async ({ np }) => {
    const paid = await openPricing(np);
    test.skip(paid === 0, 'No paid plans on staging right now (product decision 02-11: free plan only)');
    await np.getByRole('button', { name: /^شهري$/ }).click();
    await np
      .getByRole('button', { name: /^ترقية إلى / })
      .first()
      .click();
    await expect(np).toHaveURL(/pricing\/change\/\d+\?cycle=monthly/, { timeout: 30_000 });
    await expect(content(np)).toContainText('السعة المتزايدة', { timeout: 30_000 });
    // النص بيتقرا من غير ما نعتمد على شكل السطور (على الشاشة الكبيرة "10 20" بتبقى في سطر واحد)
    const t = toLatinDigits(await content(np).innerText()).replace(/\s+/g, ' ');
    const current = parseNumber(t.match(/الخطة الحالية\s*([\d,.]+)\s*L\.E/)?.[1] ?? 'NaN');
    const next = parseNumber(t.match(/الخطة الجديدة\s*([\d,.]+)\s*L\.E/)?.[1] ?? 'NaN');
    const diff = parseNumber(t.match(/الفرق\s*([\d,.]+)/)?.[1] ?? 'NaN');
    expect(diff, 'difference').toBeCloseTo(next - current, 2);
    const cap = t.split('السعة المتزايدة')[1]?.match(/الفروع\D*?(\d+)\D+?(\d+)\D*?العمال\D*?(\d+)\D+?(\d+)/);
    expect(cap, 'capacity block (branches / workers: current → new)').toBeTruthy();
    expect(Number(cap![2]), 'new branches > current').toBeGreaterThan(Number(cap![1]));
    expect(Number(cap![4]), 'new workers > current').toBeGreaterThan(Number(cap![3]));
  });
});

// إكمال الملف الشخصي: بانر "أكمل إعداد نشاطك" بيقول "يرجى استكمال: الملف الشخصي" (وناقص الإيميل والصورة في الـ API)
// التستات دي بتضيف صورة + إيميل من صفحة "إعدادات الحساب" /profile لحد ما الحساب يبقى مكتمل والبانر يختفي.
// الـ API اللي بنتأكد منه: /provider/profile/completion-status و /provider/profile/me
test.describe('7. Complete the profile (photo + email)', () => {
  /** حالة اكتمال الحساب من الـ API */
  async function completion(np: Page): Promise<{ is_profile_complete: boolean; missing_fields: string[] }> {
    const api = await kiwiApi(np, 'provider');
    const status = await api.get('/profile/completion-status');
    await api.dispose();
    return status;
  }

  // الحساب الجديد: بانر "أكمل إعداد نشاطك" بيقول "يرجى استكمال: الملف الشخصي"، والـ API بيقول الملف مش مكتمل
  // (وناقص فيه الإيميل والصورة). زرار "عرض الكل" بيفتح صفحة /profile-completion وفيها قسم "الملف الشخصي".
  // (الشكل الجديد من 02-11: البانر القديم "أكمل ملفك الشخصي / لم تضف بريدك الإلكتروني" اتشال)
  test('banner lists the missing email and photo; its button opens the profile page', async ({ np }) => {
    await np.goto('/dashboard');
    const banner = completionBanner(np);
    await expect(banner).toBeVisible({ timeout: 30_000 });
    await expect(banner).toContainText('لم تضف بريدك الإلكتروني');
    await expect(banner).toContainText('لم تضف صورة شخصية');
    const before = await completion(np);
    expect(before.is_profile_complete, 'API: profile complete before').toBe(false);
    expect(before.missing_fields.length, 'API: missing fields (email + photo)').toBeGreaterThan(0);
    // زرار "إكمال الملف الشخصي" بيودّي على صفحة الملف الشخصي
    await banner.getByRole('button', { name: 'إكمال الملف الشخصي' }).click();
    await expect(np).toHaveURL(/\/profile/, { timeout: 30_000 });
    await expect(new ProfilePage(np).email).toBeVisible({ timeout: 30_000 });
  });

  // رفع صورة شخصية (من نافذة المعرض) + كتابة إيميل تجريبي ← "حفظ التغييرات" ← "تم تحديث ملفك الشخصي بنجاح".
  // بعدها: الـ API فيه نفس الإيميل والصورة متخزنة (رابط /uploads/)، وبعد reload الإيميل والصورة لسه موجودين.
  test('add a profile photo and an email → saved (checked after reload and in the API)', async ({ np }) => {
    const email: string = info().profileEmail;
    const profile = new ProfilePage(np);
    await profile.goto();
    await profile.uploadPhoto(path.join(__dirname, '../assets/avatar.png'));
    await profile.email.fill(email);
    await profile.save.click();
    await expect(profile.successDialog).toBeVisible({ timeout: 30_000 });
    await profile.closeSuccess();

    const api = await kiwiApi(np, 'provider');
    const me = (await api.get('/profile/me')).provider;
    await api.dispose();
    expect(me.email, 'API email').toBe(email);
    expect(me.photo ?? '', 'API photo').toMatch(/\/uploads\/.+\.(png|jpe?g|webp)/i);

    await np.reload();
    await expect(profile.email).toHaveValue(email, { timeout: 30_000 });
    await expect.poll(() => profile.avatarSrc(), { message: 'avatar after reload' }).toContain('/uploads/');
  });

  // بعد الإكمال: الـ API بيقول الملف مكتمل ومفيش حاجة ناقصة، والبانر مش ظاهر في لوحة التحكم
  test('profile is complete: API says complete and the dashboard banner is gone', async ({ np }) => {
    const status = await completion(np);
    expect(status.is_profile_complete, 'API: profile complete').toBe(true);
    expect(status.missing_fields, 'API: missing fields').toEqual([]);
    await np.goto('/dashboard');
    await expect(np.getByTestId('e2e-header-branch-select-trigger')).toContainText(info().branchName, {
      timeout: 30_000,
    });
    await np.waitForLoadState('networkidle').catch(() => undefined);
    // الخدمات والعمال اتضافوا في خطوة 5، فبعد إكمال الملف الشخصي البانر كله لازم يختفي
    await expect(completionBanner(np)).toHaveCount(0, { timeout: 30_000 });
  });
});

// داتا للحساب الجديد: كل حاجة فيها رفع داتا جديدة (خدمة وعامل كمان، منتج بصورة، خصم، لوجو وبانر، صور معرض).
// تستات البروفايدر (tests/provider) بتشتغل على نفس الحساب وبتعتمد على الداتا دي.
test.describe('8. Store data (products, discount, logo, gallery, more services & workers)', () => {
  /** آخر جزء في اسم المتجر (رقم الرن) – بنستخدمه في أسماء الداتا */
  const sfx = (): string => String(info().storeName).split(' ').pop() as string;
  /** صورة تجريبية للرفع */
  const IMAGE = path.join(__dirname, '../assets/avatar.png');

  // خدمة تانية (صبغة شعر 350 ج.م – 45 دقيقة) من شاشة خدمات الفرع: المتوقع "تم إضافة الخدمة" والعدد (2)
  test('add a second service → services list shows (2)', async ({ np }) => {
    const service2 = {
      nameEn: `QA Hair Color ${sfx()}`,
      nameAr: `صبغة شعر تجريبية ${sfx()}`,
      group: 'تلوين الشعر',
      price: '350',
      duration: '45',
      descAr: 'خدمة تانية من الأوتوميشن',
      descEn: 'Second automation service',
    };
    await np.goto(`/setup-steps/branch-customisation/${branchId()}/services`);
    const s = new BranchServicesStep(np);
    await expect(s.count).toHaveText('(1)', { timeout: 30_000 });
    await s.add(service2);
    await expect(s.count).toHaveText('(2)');
    saveInfo({ service2 });
  });

  // عامل تاني (أخصائي) مربوط بالخدمة التانية: المتوقع "تم إضافة عامل الفرع" والعدد (2) – حد الخطة المجانية 3
  test('add a second worker linked to the second service → workers list shows (2)', async ({ np }) => {
    await np.goto(`/setup-steps/branch-customisation/${branchId()}/workers`);
    const w = new BranchWorkersStep(np);
    await expect(w.count).toHaveText('(1)', { timeout: 30_000 });
    const worker2 = `Worker2${sfx()}`;
    await w.add({
      firstName: 'QA',
      lastName: worker2,
      phone: randomEgyptPhone(),
      country: 'EG',
      role: 'أخصائي / مقدم خدمة',
      from: '10:00',
      fromP: 'am',
      to: '10:00',
      toP: 'pm',
      service: info().service2.nameAr,
    });
    await expect(w.count).toHaveText('(2)');
    saveInfo({ worker2: `QA ${worker2}` });
  });

  // منتج سوق جديد بصورة (150 ج.م – مخزون 20) من "منتجات السوق" ← "إضافة جديد":
  // المتوقع يظهر كارت المنتج عليه "متوفر"، والـ API بتاع الفرع فيه المنتج بنفس السعر والمخزون
  test('add a market product with an image → card shows "in stock" and the API has it', async ({ np }) => {
    const product = {
      nameAr: `سيروم شعر تجريبي ${sfx()}`,
      nameEn: `QA Hair Serum ${sfx()}`,
      descAr: 'منتج تجريبي من الأوتوميشن',
      descEn: 'Automation test product',
      price: '150',
      stock: '20',
      image: IMAGE,
    };
    const p = new ProductCreator(np);
    const category = await p.add(product);
    const card = p.rows.filter({ hasText: product.nameAr });
    await expect(card).toContainText('متوفر');
    await expect(card).toContainText('150');
    const api = await kiwiApi(np, 'provider');
    const list: any[] = await api.get(`/branches/${branchId()}/products?page=1&perPage=50`);
    await api.dispose();
    // الاسم في الـ API بييجي بلغة الطلب (عربي أو إنجليزي)
    const saved = list.find((x) => [product.nameAr, product.nameEn].includes(x.name));
    expect(saved, 'product in the branch API').toBeTruthy();
    expect(Number(saved.price), 'price').toBe(150);
    expect(Number(saved.stock), 'stock').toBe(20);
    expect(saved.main_image?.media_url ?? '', 'main image').toMatch(/\/uploads\//);
    saveInfo({ product: { ...product, category } });
  });

  // خصم 15% على الفرع (كل المنتجات وكل الخدمات) من النهارده لمدة أسبوع:
  // المتوقع "تمت إضافة الخصم بنجاح" وكارت الخصم فيه الرمز و 15%
  test('add a 15% discount for the branch → discount card is listed', async ({ np }) => {
    const code = `QA${sfx()}`;
    await new DiscountCreator(np).create(info().branchName, code, '15');
    const card = np.locator('[data-testid^="e2e-discount-card-"]').filter({ hasText: code });
    await expect(card).toContainText('15%');
    saveInfo({ discountCode: code });
  });

  // لوجو وبانر المتجر من "تفاصيل المتجر" ← "تعديل المتجر": المتوقع "تم تحديث المتجر بنجاح"
  // والـ API بتاع المتجر فيه logo و cover (روابط /uploads/)
  test('upload the store logo and cover → saved in the store API', async ({ np }) => {
    await new ShopEditor(np).uploadLogoAndCover(IMAGE, IMAGE);
    const api = await kiwiApi(np, 'provider');
    const store = await api.get('/stores');
    await api.dispose();
    expect(store.logo ?? '', 'store logo').toMatch(/\/uploads\//);
    expect(store.cover ?? '', 'store cover').toMatch(/\/uploads\//);
  });

  // معرض الفرع: "إضافة صورة جديدة" ← نختار صورتين من معرض المتجر ← المتوقع "معرض صور الفرع (2)"
  test('add 2 images to the branch gallery → gallery shows (2)', async ({ np }) => {
    await new BranchGallery(np).add(2);
    await expect(new BranchGallery(np).count).toHaveText('(2)', { timeout: 30_000 });
  });

  // ملخص المتجر من الـ API بعد كل الإضافات: خدمتين، عاملين، ومنتج واحد على الأقل
  test('store counters in the API: 2 services, 2 workers, ≥ 1 product', async ({ np }) => {
    await np.goto('/dashboard?tab=home');
    const api = await kiwiApi(np, 'provider');
    const store = await api.get('/stores');
    await api.dispose();
    expect(store.services_count, 'services').toBe(2);
    expect(store.workers_count, 'workers').toBe(2);
    expect(store.products_count, 'products').toBeGreaterThanOrEqual(1);
  });
});
