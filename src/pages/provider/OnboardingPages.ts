/**
 * Page objects رحلة البروفايدر الجديد من الصفر:
 *   1) إنشاء حساب          /sign-up
 *   2) رمز التحقق          /verify-sign-up-otp   (الكود ثابت 9999 على staging)
 *   3) حماية الحساب        /sign-up/setup-authenticator  ← "ربما لاحقًا"
 *   4) اكتمل التسجيل       /sign-up/complete  ← "ابدأ إعداد نشاطك التجاري"
 *   5) إعداد المتجر        /setup-steps/shop
 *   6) إعداد الفرع         /setup-steps/branch
 *   7) تخصيص الفرع         /setup-steps/branch-customisation/<branchId>/work-hours | services | workers
 *
 * كل الـ locators هنا معمولة على data-testid اللي في الموقع نفسه، فمش بتتأثر بتغيير النصوص.
 */
import { Page, Locator, expect } from '@playwright/test';
import { DIAL_CODE, CountryCode } from '../../config/env';
import { FIXED_OTP } from '../../config/otp';

/** بيانات الحساب الجديد اللي التست بيسجّل بيها */
export type NewProvider = {
  firstName: string;
  lastName: string;
  phone: string;
  country: CountryCode;
  email?: string;
};

/**
 * helper: بيختار الدولة من زرار العلم اللي جنب خانة التليفون.
 * الزرار بيفتح بحث "ابحث عن الدولة..." – بنكتب كود الدولة (+20) ونختار أول نتيجة بالكيبورد (Enter).
 * الطريقة دي شغالة في صفحة التسجيل وجوه dialog العامل كمان.
 */
export async function pickPhoneCountry(page: Page, phoneInput: Locator, country: CountryCode): Promise<void> {
  const dial = DIAL_CODE[country];
  const flagButton = phoneInput.locator('xpath=ancestor::*[.//button][1]').getByRole('button').first();
  await flagButton.click();
  const search = page.getByPlaceholder('ابحث عن الدولة...');
  await expect(search).toBeVisible();
  await search.fill(dial);
  // أول اختيار بيتعمله highlight، والـ Enter بيختاره (أضمن من الضغط على الاختيار نفسه جوه الـ dialog)
  await page.keyboard.press('Enter');
}

/**
 * helper: بيكتب في خانة ويتأكد إن القيمة اتكتبت فعلاً.
 * الصفحات دي ساعات بتعمل reset للفورم أول ما تحمّل (hydration)، فلو الكتابة ضاعت بنعيدها.
 */
async function fillStable(input: Locator, value: string): Promise<void> {
  await expect(async () => {
    await input.fill(value);
    await expect(input).toHaveValue(value, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

/** شاشة إنشاء حساب /sign-up */
export class SignUpForm {
  constructor(private page: Page) {}

  // الخانات والزراير بالـ testid بتاعها
  get firstName(): Locator {
    return this.page.getByTestId('sign-up-first-name');
  }
  get lastName(): Locator {
    return this.page.getByTestId('sign-up-last-name');
  }
  get phone(): Locator {
    return this.page.getByTestId('sign-up-phone-input');
  }
  get email(): Locator {
    return this.page.getByPlaceholder('أدخل بريدك الإلكتروني');
  }
  get terms(): Locator {
    return this.page.getByTestId('sign-up-agree-terms');
  }
  get submit(): Locator {
    return this.page.getByTestId('sign-up-submit');
  }
  /** رسايل الخطأ اللي تحت الخانات (اللون الأحمر) */
  get errors(): Locator {
    return this.page.locator('form p[class*="destructive"], form p[class*="red"]');
  }

  /** بيفتح صفحة التسجيل ويستنى الفورم يجهز */
  async goto(): Promise<void> {
    await this.page.goto('/sign-up');
    await expect(this.firstName).toBeVisible({ timeout: 30_000 });
    await this.page.waitForLoadState('networkidle').catch(() => undefined);
  }

  /** بيملا الفورم كله (ومن غير ما يدوس إنشاء حساب) */
  async fill(p: NewProvider): Promise<void> {
    await fillStable(this.firstName, p.firstName);
    await fillStable(this.lastName, p.lastName);
    await pickPhoneCountry(this.page, this.phone, p.country);
    await fillStable(this.phone, p.phone);
    if (p.email) {
      await fillStable(this.email, p.email);
    }
  }

  /** بيعلّم على الموافقة على الشروط ويتأكد إنها اتعلّمت */
  async acceptTerms(): Promise<void> {
    if ((await this.terms.getAttribute('aria-checked')) !== 'true') {
      await this.terms.click();
    }
    await expect(this.terms).toHaveAttribute('aria-checked', 'true');
  }
}

/** شاشة رمز التحقق بعد التسجيل /verify-sign-up-otp */
export class SignUpOtp {
  constructor(private page: Page) {}

  /** خانة الكود (input واحد طوله 4 جوه auth-otp-input) */
  get input(): Locator {
    return this.page.getByTestId('auth-otp-input').locator('input');
  }
  /**
   * رسالة "رمز التحقق غير صالح" تحت خانة الكود.
   * الموقع بقى يطلع نفس الرسالة كمان في toast تحت، فبناخد اللي تحت خانة الكود (أول واحدة) عشان strict mode.
   */
  get invalid(): Locator {
    return this.page
      .getByTestId('auth-otp-input')
      .getByText('رمز التحقق غير صالح')
      .or(this.page.getByText('رمز التحقق غير صالح'))
      .first();
  }

  /** بيستنى الشاشة ويكتب الكود (الافتراضي 9999). الشاشة بتعمل submit لوحدها بعد آخر رقم */
  async enter(code = FIXED_OTP): Promise<void> {
    await expect(this.page).toHaveURL(/verify-sign-up-otp/, { timeout: 30_000 });
    await this.input.click();
    await this.page.keyboard.type(code, { delay: 80 });
  }
}

/** الشاشات اللي بعد الـ OTP: "احمِ حسابك" و"اكتمل التسجيل" */
export class SignUpAfterOtp {
  constructor(private page: Page) {}

  /** زرار "ربما لاحقًا" في شاشة تفعيل تطبيق المصادقة */
  get maybeLater(): Locator {
    return this.page.getByTestId('signup-setup-authenticator-maybe-later');
  }
  /** زرار "ابدأ إعداد نشاطك التجاري" في شاشة "اكتمل التسجيل" */
  get startSetup(): Locator {
    return this.page.getByRole('link', { name: 'ابدأ إعداد نشاطك التجاري' });
  }

  /** بيتخطى المصادقة الثنائية ويدخل على إعداد المتجر */
  async skipAuthenticatorAndStart(): Promise<void> {
    await expect(this.page).toHaveURL(/setup-authenticator/, { timeout: 30_000 });
    await this.maybeLater.click();
    await expect(this.page).toHaveURL(/sign-up\/complete/, { timeout: 30_000 });
    await this.startSetup.click();
    await expect(this.page).toHaveURL(/setup-steps\/shop/, { timeout: 30_000 });
  }
}

/** بيانات المتجر في خطوة "إعداد المتجر" */
export type ShopData = {
  name: string;
  category: string;
  countryName: string | RegExp;
  bioEn: string;
  bioAr: string;
};

/** خطوة 1: إعداد المتجر /setup-steps/shop */
export class SetupShopStep {
  constructor(private page: Page) {}

  get name(): Locator {
    return this.page.getByTestId('setup-shop-name-input');
  }
  get category(): Locator {
    return this.page.getByTestId('setup-shop-category-field').getByRole('button').first();
  }
  get country(): Locator {
    return this.page.getByTestId('setup-shop-country-select').getByRole('button').first();
  }
  get bioEn(): Locator {
    return this.page.getByTestId('setup-shop-bio-en-input');
  }
  get bioAr(): Locator {
    return this.page.getByTestId('setup-shop-bio-ar-input');
  }
  get next(): Locator {
    return this.page.getByTestId('setup-form-next-button');
  }
  /** رسايل الخطأ تحت الخانات */
  get errors(): Locator {
    return this.page.locator('form').getByText(/مطلوب|مطلوبة/);
  }

  /** بيستنى الفورم يخلص تحميل (فيه loader الأول اسمه setup-shop-loading) */
  async waitReady(): Promise<void> {
    await expect(this.name).toBeVisible({ timeout: 45_000 });
  }

  /** بيملا بيانات المتجر ويدوس "الخطوة التالية" ويستنى صفحة الفرع */
  async fillAndNext(d: ShopData): Promise<void> {
    await this.waitReady();
    await fillStable(this.name, d.name);
    await this.category.click();
    await this.page.getByRole('option', { name: d.category }).first().click();
    await this.country.click();
    await this.page.getByRole('option').filter({ hasText: d.countryName }).first().click();
    await fillStable(this.bioEn, d.bioEn);
    await fillStable(this.bioAr, d.bioAr);
    await this.next.click();
    await expect(this.page).toHaveURL(/setup-steps\/branch/, { timeout: 45_000 });
  }
}

/** خطوة 2: إعداد الفرع /setup-steps/branch */
export class SetupBranchStep {
  constructor(private page: Page) {}

  get name(): Locator {
    return this.page.getByTestId('setup-branch-name-input');
  }
  /** الخانة اللي بتفتح نافذة "إضافة موقع" (الخريطة) */
  get locationTrigger(): Locator {
    return this.page.getByTestId('setup-branch-location-trigger');
  }
  get next(): Locator {
    return this.page.getByTestId('setup-form-next-button');
  }

  /**
   * بيختار الموقع: يفتح الخريطة، يكتب في البحث (مثلاً "Nasr City Cairo")، يختار أول نتيجة ويدوس حفظ.
   * المتوقع بعدها العنوان يظهر في خانة "إضافة موقع".
   */
  async pickLocation(search: string): Promise<void> {
    await this.locationTrigger.click();
    const dlg = this.page.getByRole('dialog').last();
    await expect(dlg).toContainText('إضافة موقع');
    // لازم كتابة حرف حرف (زي المستخدم): قائمة النتايج مابتفتحش مع fill
    const input = dlg.getByPlaceholder(/بحث/);
    await input.click();
    await input.pressSequentially(search, { delay: 60 });
    // النتائج بتظهر تحت البحث – بنختار أول نتيجة ظاهرة فيها اسم المكان (فيه نسخ مخفية في الصفحة)
    const first = dlg
      .getByText(new RegExp(search.split(' ')[0], 'i'))
      .filter({ visible: true })
      .first();
    await expect(first).toBeVisible({ timeout: 30_000 });
    await first.click();
    // بعد الاختيار العنوان بيتكتب تحت البحث (مثلاً "Nasr City, Cairo Governorate, Egypt")
    await expect(
      dlg
        .getByText(/Egypt|مصر/)
        .filter({ visible: true })
        .first(),
    ).toBeVisible({ timeout: 20_000 });
    await dlg.getByRole('button', { name: 'حفظ' }).click();
    await expect(dlg).toBeHidden();
  }

  /** بيملا اسم الفرع والموقع ويدوس التالي، وبيرجّع رقم الفرع من اللينك (branch-customisation/<id>) */
  async fillAndNext(name: string, locationSearch: string): Promise<number> {
    await expect(this.name).toBeVisible({ timeout: 45_000 });
    await fillStable(this.name, name);
    await this.pickLocation(locationSearch);
    await this.next.click();
    await expect(this.page).toHaveURL(/branch-customisation\/\d+\/work-hours/, { timeout: 45_000 });
    return Number(this.page.url().match(/branch-customisation\/(\d+)/)![1]);
  }
}

/** أيام الأسبوع بالترتيب اللي في الشاشة (السبت → الجمعة) */
export const WEEK_DAYS = [
  'saturday',
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
] as const;

/** خطوة 3-أ: ساعات العمل /setup-steps/branch-customisation/<id>/work-hours */
export class WorkHoursStep {
  constructor(private page: Page) {}

  /** الاختيارات التلاتة: 24/7 أو أوقات ثابتة لأيام محددة أو أوقات مختلفة لكل يوم */
  radio(kind: '24-7' | 'fixed-times' | 'different-times'): Locator {
    return this.page.getByTestId(`work-hours-radio-${kind}`);
  }
  /** زرار يوم من الأيام (saturday … friday) */
  day(d: (typeof WEEK_DAYS)[number]): Locator {
    return this.page.getByTestId(`work-hours-day-${d}`);
  }
  get startInput(): Locator {
    return this.page.getByTestId('work-hours-shared-start-input');
  }
  get endInput(): Locator {
    return this.page.getByTestId('work-hours-shared-end-input');
  }
  /** زرار ص/م لوقت الافتتاح أو الإغلاق */
  ampm(which: 'start' | 'end', p: 'am' | 'pm'): Locator {
    return this.page.getByTestId(`work-hours-shared-${which}-${p}-button`);
  }
  get next(): Locator {
    return this.page.getByTestId('setup-form-next-button');
  }

  /** بيكتب وقت بالشكل 0900 في الخانة (الخانة نفسها بتحطه 09:00) */
  async typeTime(input: Locator, hhmm: string): Promise<void> {
    await input.click();
    await input.press('Control+A');
    await input.pressSequentially(hhmm.replace(':', ''), { delay: 50 });
  }

  /**
   * بيختار "أوقات ثابتة لأيام محددة" ويعلّم الأيام المطلوبة ويكتب الوقت.
   * مثال: setFixedTimes(WEEK_DAYS, '09:00', 'am', '11:00', 'pm') = كل يوم من 9 الصبح لـ 11 بالليل.
   */
  async setFixedTimes(
    days: readonly (typeof WEEK_DAYS)[number][],
    start: string,
    startP: 'am' | 'pm',
    end: string,
    endP: 'am' | 'pm',
  ): Promise<void> {
    await this.radio('fixed-times').click();
    for (const d of days) {
      if ((await this.day(d).getAttribute('data-state')) !== 'checked') {
        await this.day(d).click();
      }
    }
    await this.typeTime(this.startInput, start);
    await this.ampm('start', startP).click();
    await this.typeTime(this.endInput, end);
    await this.ampm('end', endP).click();
  }
}

/** بيانات خدمة جديدة */
export type ServiceData = {
  nameEn: string;
  nameAr: string;
  group: string;
  price: string;
  duration: string;
  descAr: string;
  descEn: string;
};

/** خطوة 3-ب: خدمات الفرع + نافذة "إضافة خدمة" */
export class BranchServicesStep {
  constructor(private page: Page) {}

  /** زرار "إضافة خدمة جديدة" (لو مفيش خدمات) أو "إضافة جديد" (لو فيه) */
  get addButton(): Locator {
    return this.page
      .getByTestId('setup-empty-state-services-add')
      .or(this.page.getByTestId('e2e-services-add-branch'))
      .first();
  }
  /** عدد الخدمات اللي جنب "قائمة الخدمات" */
  get count(): Locator {
    return this.page.getByTestId('e2e-services-count');
  }
  get next(): Locator {
    return this.page.getByTestId('setup-form-next-button');
  }
  /** خانات نافذة إضافة الخدمة */
  get form() {
    const p = this.page;
    return {
      nameEn: p.getByTestId('e2e-branch-service-name-en'),
      nameAr: p.getByTestId('e2e-branch-service-name-ar'),
      group: p.getByTestId('e2e-branch-service-category').getByRole('button').first(),
      price: p.getByTestId('e2e-branch-service-price'),
      currency: p.getByTestId('e2e-branch-service-price-currency'),
      duration: p.getByTestId('e2e-branch-service-duration'),
      descAr: p.getByTestId('e2e-branch-service-desc-ar'),
      descEn: p.getByTestId('e2e-branch-service-desc-en'),
      submit: p.getByTestId('e2e-branch-service-submit'),
      dialog: p.getByRole('dialog').last(),
    };
  }

  /** بيفتح نافذة الإضافة ويملاها ويحفظ. المتوقع رسالة "تم إضافة الخدمة" */
  async add(s: ServiceData): Promise<void> {
    await this.addButton.click();
    const f = this.form;
    await expect(f.nameEn).toBeVisible();
    await f.nameEn.fill(s.nameEn);
    await f.nameAr.fill(s.nameAr);
    await f.group.click();
    // مجموعات الخدمات جاية من الأدمن وبتتغيّر (مثلاً "عناية بالشعر" اتشالت 02-11):
    // بنختار المجموعة المطلوبة لو موجودة، ولو مش موجودة أول مجموعة في القايمة.
    const options = this.page.getByRole('option');
    await expect(options.first()).toBeVisible();
    const wanted = this.page.getByRole('option', { name: s.group, exact: true });
    await ((await wanted.count()) ? wanted.first() : options.first()).click();
    await f.price.fill(s.price);
    await f.duration.fill(s.duration);
    await f.descAr.fill(s.descAr);
    await f.descEn.fill(s.descEn);
    await f.submit.click();
    await expect(this.page.getByText(/تم إضافة الخدمة/).first()).toBeVisible({ timeout: 20_000 });
  }
}

/** بيانات عامل جديد */
export type WorkerData = {
  firstName: string;
  lastName: string;
  phone: string;
  country: CountryCode;
  role: string;
  from: string;
  fromP: 'am' | 'pm';
  to: string;
  toP: 'am' | 'pm';
  service: string;
};

/** خطوة 3-ج: عمال الفرع + نافذة "إضافة عامل للفرع" */
export class BranchWorkersStep {
  constructor(private page: Page) {}

  get addButton(): Locator {
    return this.page
      .getByTestId('setup-empty-state-workers-add')
      .or(this.page.getByTestId('e2e-workers-add-branch'))
      .first();
  }
  get count(): Locator {
    return this.page.getByTestId('e2e-workers-count');
  }
  /** آخر زرار في الإعداد: "الذهاب إلى لوحة التحكم" */
  get finish(): Locator {
    return this.page.getByTestId('setup-form-next-button');
  }
  /** خانات نافذة إضافة العامل */
  get form() {
    const p = this.page;
    return {
      dialog: p.getByTestId('e2e-workers-branch-worker-dialog'),
      firstName: p.getByTestId('e2e-branch-worker-first-name'),
      lastName: p.getByTestId('e2e-branch-worker-last-name'),
      phone: p.getByTestId('e2e-branch-worker-phone'),
      role: p.getByTestId('e2e-branch-worker-role').getByRole('button').first(),
      daysTrigger: p.getByTestId('e2e-worker-working-days-trigger'),
      everyDay: p.getByTestId('e2e-worker-working-days-everyday'),
      dayCheckboxes: p.getByRole('checkbox'),
      from: p.getByTestId('e2e-worker-working-from').locator('input'),
      to: p.getByTestId('e2e-worker-working-to').locator('input'),
      fromP: (x: 'am' | 'pm') =>
        p.getByTestId('e2e-worker-working-from').getByRole('button', { name: x === 'am' ? 'ص' : 'م' }),
      toP: (x: 'am' | 'pm') =>
        p.getByTestId('e2e-worker-working-to').getByRole('button', { name: x === 'am' ? 'ص' : 'م' }),
      services: p.getByTestId('e2e-branch-worker-services').getByRole('button').first(),
      submit: p.getByTestId('e2e-branch-worker-submit'),
    };
  }

  /** بيكتب وقت 0900 في خانة الوقت */
  private async typeTime(input: Locator, hhmm: string): Promise<void> {
    await input.click();
    await input.press('Control+A');
    await input.pressSequentially(hhmm.replace(':', ''), { delay: 50 });
  }

  /** بيفتح نافذة الإضافة ويملاها ويحفظ. المتوقع رسالة "تم إضافة عامل الفرع" */
  async add(w: WorkerData): Promise<void> {
    await this.addButton.click();
    const f = this.form;
    await expect(f.firstName).toBeVisible();
    await f.firstName.fill(w.firstName);
    await f.lastName.fill(w.lastName);
    await pickPhoneCountry(this.page, f.phone, w.country);
    await f.phone.fill(w.phone);
    await f.role.click();
    await this.page.getByRole('option', { name: w.role }).first().click();
    await f.daysTrigger.click();
    await f.everyDay.click();
    // نقفل قائمة الأيام بالضغط على عنوان النافذة (الـ Escape ممكن يقفل النافذة كلها)
    await f.dialog.getByText('إضافة عامل للفرع').first().click();
    await this.typeTime(f.from, w.from);
    await f.fromP(w.fromP).click();
    await this.typeTime(f.to, w.to);
    await f.toP(w.toP).click();
    // خانة "الخدمات" بتظهر بس لدور مقدم الخدمة
    if (await f.services.isVisible().catch(() => false)) {
      await f.services.click();
      await this.page.getByRole('option').filter({ hasText: w.service }).first().click();
      await f.dialog.getByText('إضافة عامل للفرع').first().click();
    }
    await f.submit.click();
    await expect(this.page.getByText(/تم إضافة عامل الفرع/).first()).toBeVisible({ timeout: 20_000 });
  }
}
