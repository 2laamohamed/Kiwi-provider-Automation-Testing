/**
 * تسجيل دخول البروفايدر بالرقم + OTP (9999 على staging) + 2FA لو مفعّل.
 * في ملف لوحده عشان provider.fixture و qaProvider الاتنين بيستخدموه من غير ما يعملوا import لبعض.
 */
import { Page, expect } from '@playwright/test';
import { env } from '../config/env';
import { getOtp, getMfaCode } from '../config/otp';
import { SignInPage, OtpPage } from '../pages/provider/AuthPages';

/**
 * تسجيل دخول كامل: رقم → OTP (WhatsApp أو 9999 حسب src/config/otp.ts) → 2FA لو مفعّل.
 * بتخلص لما الصفحة تسيب sign-in و verify-.
 */
export async function loginWithOtp(page: Page, phone: string, country = env.provider.country): Promise<void> {
  const signIn = new SignInPage(page);
  const otp = new OtpPage(page);
  await signIn.goto();
  await signIn.requestOtp(phone, country);
  await expect(otp.boxes.first()).toBeVisible({ timeout: 30_000 });
  const code = await getOtp(page, phone);
  if (code) {
    await otp.enter(code);
  }
  await page.waitForURL((u) => !/verify-sign-in-otp/.test(u.pathname), { timeout: 60_000 });
  // 2FA (Google Authenticator) – لو ظهرت شاشة verify-mfa
  if (/verify-mfa/.test(page.url())) {
    const mfa = await getMfaCode(page);
    if (mfa) {
      await page.locator('input').first().click();
      await page.keyboard.type(mfa, { delay: 60 });
      await page.getByRole('button', { name: /متابعة|Continue/ }).click();
    }
  }
  await page.waitForURL((u) => !/sign-in|verify-/.test(u.pathname), { timeout: 60_000 });
}
