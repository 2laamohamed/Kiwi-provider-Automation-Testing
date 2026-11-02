/**
 * حسابات البروفايدر التجريبية اللي تستات الربط (integration 06 و 07) بتستخدمها.
 *
 * فيه حسابين:
 *  1) "البروفايدر الجديد" – بيتعمل من الصفر كل ما تشغّلي npm run test:onboarding،
 *     وبياناته بتتحفظ في .auth/new-provider.json (الرقم، رقم المتجر، رقم الفرع...).
 *  2) "بروفايدر الحجوزات" – حساب ثابت عليه حجوزات كاش اتعملت من تطبيق العميل
 *     (الافتراضي: QAAuto Provider 01550110183 – متجر QA Auto Salon رقم 120 – فرع 129).
 *     ممكن تغيّريه من .env: BOOKING_PROVIDER_PHONE / BOOKING_PROVIDER_STORE_ID / BOOKING_PROVIDER_BRANCH_ID
 *
 * الدخول بيتم أوتوماتيك بالرقم + OTP 9999، والسيشن بيتحفظ في .auth عشان مايعملش login كل مرة.
 */
import { Browser, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { env, AUTH_FILES } from '../config/env';
import { loginWithOtp } from './login';
import { autoDismissPopups } from '../utils/popups';
import { withStableGoto } from '../utils/stableGoto';

/** بيانات حساب بروفايدر تجريبي */
export type QaProviderInfo = {
  phone: string;
  country: 'EG' | 'SA' | 'AE';
  storeId: number;
  branchId: number;
  storeName: string;
  /** اسم الفرع زي ما بيظهر في الهيدر */
  branchName: string;
  service?: { nameAr: string };
  /** مكان ملف السيشن بتاع الحساب ده */
  authFile: string;
};

/** حساب الحجوزات الثابت (من .env أو القيم الافتراضية) */
export function bookingProvider(): QaProviderInfo {
  return {
    phone: process.env.BOOKING_PROVIDER_PHONE || '1550110183',
    country: 'EG',
    storeId: Number(process.env.BOOKING_PROVIDER_STORE_ID || 120),
    branchId: Number(process.env.BOOKING_PROVIDER_BRANCH_ID || 129),
    storeName: process.env.BOOKING_PROVIDER_STORE_NAME || 'QA Auto Salon',
    branchName: process.env.BOOKING_PROVIDER_BRANCH_NAME || 'QA Branch Cairo',
    service: { nameAr: process.env.BOOKING_PROVIDER_SERVICE || 'قص شعر تجريبي' },
    authFile: path.resolve(path.dirname(AUTH_FILES.newProvider), 'provider-booking.json'),
  };
}

/**
 * البروفايدر الجديد اللي onboarding عمله آخر مرة.
 * لو onboarding لسه ماتشغّلش (مفيش ملف) بيرجّع حساب الحجوزات بداله.
 */
export function onboardedProvider(): QaProviderInfo {
  if (!fs.existsSync(AUTH_FILES.newProviderInfo)) {
    return bookingProvider();
  }
  const info = JSON.parse(fs.readFileSync(AUTH_FILES.newProviderInfo, 'utf-8'));
  if (!info.storeId) {
    throw new Error('آخر رن لـ onboarding ماوصلش لخطوة إنشاء المتجر – شغّلي npm run test:onboarding تاني');
  }
  return { ...info, authFile: AUTH_FILES.newProvider };
}

/**
 * الحساب الأساسي لتستات البروفايدر (tests/provider): آخر حساب عمله onboarding.
 * onboarding بيضيفله متجر وفرع وخدمتين وعاملين ومنتج بصورة وخصم ولوجو وصور معرض وصورة شخصية وإيميل،
 * فتستات البروفايدر بتلاقي داتا معروفة. لو onboarding لسه ماتشغّلش بيرجّع حساب الحجوزات.
 */
export function mainProvider(): QaProviderInfo {
  return onboardedProvider();
}

/**
 * الحساب اللي تستات المواعيد بتقرا منه = نفس الحساب الجديد اللي onboarding عمله (مفيش حساب ثابت تاني).
 * المواعيد بتتعمل من تطبيق العميل، فلو الحساب الجديد مفيهوش مواعيد تستات تفاصيل الموعد بتتعمل skip بسبب واضح.
 */
export function dataProvider(): QaProviderInfo {
  return onboardedProvider();
}

/**
 * بيفتح صفحة داخلة بالحساب: لو فيه سيشن محفوظ وشغال بيستخدمه، وإلا بيعمل login بالرقم + 9999 ويحفظ السيشن.
 * الصفحة بتتقفل من التست نفسه: await page.context().close()
 */
export async function openProviderAs(browser: Browser, who: QaProviderInfo): Promise<Page> {
  const base = {
    baseURL: env.provider.baseURL,
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
    viewport: { width: 1440, height: 900 },
    // بنسمح بالإشعارات عشان نافذة/بانر "تفعيل الإشعارات" مايظهروش ويغطّوا الصفحة
    permissions: ['notifications'],
  };
  if (fs.existsSync(who.authFile)) {
    const ctx = await browser.newContext({ ...base, storageState: who.authFile });
    const page = withStableGoto(await ctx.newPage());
    await autoDismissPopups(page);
    await page.goto('/dashboard?tab=home');
    if (!/sign-in|verify-/.test(page.url())) {
      return page;
    }
    await ctx.close();
  }
  const ctx = await browser.newContext(base);
  const page = withStableGoto(await ctx.newPage());
  await autoDismissPopups(page);
  await loginWithOtp(page, who.phone, who.country);
  fs.mkdirSync(path.dirname(who.authFile), { recursive: true });
  await ctx.storageState({ path: who.authFile });
  return page;
}
