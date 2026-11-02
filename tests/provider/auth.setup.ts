// الملف ده مش تست عادي، ده خطوة "setup" بتشتغل قبل كل تستات البروفايدر (Business owner).
// الشاشات: تسجيل الدخول  /sign-in  ورمز التحقق  /verify-sign-in-otp
//
// الربط مع onboarding:
//   الحساب الأساسي لتستات البروفايدر = آخر حساب عمله npm run test:onboarding (رقمه في .auth/new-provider.json).
//   onboarding بيجهّزه بداتا معروفة (خدمتين، عاملين، منتج، خصم، لوجو، صور معرض، صورة شخصية وإيميل)،
//   فتستات البروفايدر بتلاقي نفس الداتا كل مرة. مفيش أي حساب ثابت – كل رن بيعمل حساب وداتا جديدة.
//   لازم تشغّلي npm run test:onboarding الأول (أو npm run test:all).
//
// الدخول أوتوماتيك بالرقم + OTP 9999 (مفيش دخول يدوي)، والسيشن بيتحفظ في .auth عشان مايعملش login كل مرة.
import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { AUTH_FILES } from '../../src/config/env';
import { mainProvider, openProviderAs } from '../../src/fixtures/qaProvider';

// دخول الحساب الأساسي (حساب onboarding) وحفظ السيشن في .auth/provider.json اللي كل تستات البروفايدر بتستخدمه.
setup('login provider (onboarding account)', async ({ browser }) => {
  setup.setTimeout(3 * 60_000);
  const who = mainProvider();
  setup.info().annotations.push({ type: 'account', description: `${who.phone} – ${who.storeName}` });
  const page = await openProviderAs(browser, who);
  await expect(page).not.toHaveURL(/sign-in|verify-/);
  fs.mkdirSync(path.dirname(AUTH_FILES.provider), { recursive: true });
  await page.context().storageState({ path: AUTH_FILES.provider });
  await page.context().close();
});
