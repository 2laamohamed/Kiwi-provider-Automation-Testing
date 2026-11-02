/**
 * Page objects شاشات الدخول في موقع البروفايدر:
 * تسجيل الدخول /ar/sign-in (رقم التليفون + اختيار الدولة)،
 * شاشة كود الـ OTP (verify-sign-in-otp)، وإنشاء حساب جديد /ar/sign-up.
 * الكود نفسه بيتجاب من src/config/otp.ts.
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { AR } from '../../utils/texts';
import { CountryCode } from '../../config/env';
import { pickPhoneCountry } from './OnboardingPages';

/** صفحة تسجيل الدخول /ar/sign-in */
export class SignInPage extends BasePage {
  /** خانة رقم التليفون */
  readonly phoneInput: Locator;
  /** زرار "تسجيل الدخول" */
  readonly submit: Locator;
  /** لينك "إنشاء حساب" */
  readonly createAccountLink: Locator;

  /** بيجهّز الـ locators بتاعة الصفحة */
  constructor(page: Page) {
    super(page);
    this.phoneInput = page.getByPlaceholder(AR.auth.phonePlaceholder);
    this.submit = page.getByRole('button', { name: AR.auth.signIn });
    this.createAccountLink = page
      .getByRole('link', { name: AR.auth.createAccount })
      .or(page.getByText(AR.auth.createAccount, { exact: true }))
      .first();
  }

  /** بيفتح /ar/sign-in ويستنى خانة الرقم */
  async goto(): Promise<void> {
    await this.open('/ar/sign-in');
    await expect(this.phoneInput).toBeVisible();
  }

  /**
   * بيختار الدولة: زرار العلم جنب خانة الرقم ← بحث "ابحث عن الدولة..." بكود الدولة (+20) ← Enter
   * (نفس الطريقة اللي شغالة في شاشة التسجيل في onboarding)
   */
  async selectCountry(country: CountryCode): Promise<void> {
    await pickPhoneCountry(this.page, this.phoneInput, country);
  }

  /** بيختار الدولة (لو اتبعتت) ويكتب الرقم ويدوس دخول عشان الـ OTP يتبعت */
  async requestOtp(phone: string, country?: CountryCode): Promise<void> {
    await expect(this.phoneInput).toBeVisible();
    if (country) {
      await this.selectCountry(country);
    }
    await this.phoneInput.fill(phone);
    await expect(this.phoneInput).toHaveValue(phone);
    await this.submit.click();
    // السيرفر بيسمح بكود واحد كل دقيقة لنفس الرقم: لو ظهرت "يرجى الانتظار دقيقة..." نستنى دقيقة ونطلب تاني
    const sent = await this.page
      .waitForURL(/verify-sign-in-otp/, { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (!sent && (await this.otpWaitMessage.isVisible().catch(() => false))) {
      await this.page.waitForTimeout(61_000);
      await this.submit.click();
      await this.page.waitForURL(/verify-sign-in-otp/, { timeout: 30_000 });
    }
  }

  /** رسالة "يرجى الانتظار دقيقة واحدة على الأقل قبل طلب رمز تحقق آخر." (كود واحد كل دقيقة لنفس الرقم) */
  get otpWaitMessage(): Locator {
    return this.page.getByText(AR.auth.otpWait).first();
  }
}

/** شاشة إدخال كود الـ OTP (بعد ما نطلب الكود من صفحة الدخول) */
export class OtpPage extends BasePage {
  /** عنوان "رمز التحقق" */
  readonly title: Locator;

  /** بيجهّز الـ locators بتاعة الشاشة */
  constructor(page: Page) {
    super(page);
    this.title = page.getByText(AR.auth.otpTitle).first();
  }

  /** خانة الـ OTP – input واحد maxlength=4 (autocomplete=one-time-code) بيترسم كـ 4 مربعات */
  get boxes(): Locator {
    return this.page.locator('input[autocomplete="one-time-code"], input[inputmode="numeric"][maxlength]');
  }

  /** زرار التأكيد في شاشة الـ OTP */
  get submit(): Locator {
    return this.page.getByRole('button', { name: AR.auth.signIn });
  }

  /** بيكتب الكود في الخانة، ولو الصفحة ماعملتش submit لوحدها بيدوس الزرار */
  async enter(code: string): Promise<void> {
    await expect(this.boxes.first()).toBeVisible();
    await this.boxes.first().click();
    await this.page.keyboard.type(code, { delay: 80 });
    // بعض الشاشات بتعمل submit أوتوماتيك، وبعضها محتاج زرار
    await this.page.waitForTimeout(1500);
    if (/verify-.*otp/.test(this.page.url()) && (await this.submit.isEnabled().catch(() => false))) {
      await this.submit.click().catch(() => undefined);
    }
  }

  /** زرار "إعادة إرسال" الكود */
  get resend(): Locator {
    return this.page.getByText(AR.auth.resend).first();
  }

  /** رسالة "رمز التحقق غير صالح" */
  get invalidOtpMessage(): Locator {
    return this.page.getByText(AR.auth.invalidOtp).first();
  }
}

/** صفحة إنشاء حساب جديد /ar/sign-up */
export class SignUpPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /** خانة الاسم الأول */
  get firstName(): Locator {
    return this.page.getByPlaceholder(AR.auth.namePlaceholder).nth(0);
  }
  /** خانة اسم العيلة */
  get lastName(): Locator {
    return this.page.getByPlaceholder(AR.auth.namePlaceholder).nth(1);
  }
  /** خانة رقم التليفون */
  get phone(): Locator {
    return this.page.getByPlaceholder(AR.auth.phonePlaceholder);
  }
  /** خانة الإيميل */
  get email(): Locator {
    return this.page.getByPlaceholder(AR.auth.emailPlaceholder);
  }
  /** checkbox الموافقة على الشروط */
  get termsCheckbox(): Locator {
    return this.page.getByRole('checkbox').first();
  }
  /** زرار "إنشاء حساب" */
  get submit(): Locator {
    return this.page.getByRole('button', { name: AR.auth.createAccount });
  }

  /** بيفتح /ar/sign-up ويستنى خانة الاسم */
  async goto(): Promise<void> {
    await this.open('/ar/sign-up');
    await expect(this.firstName).toBeVisible();
  }
}
