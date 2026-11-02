/**
 * إعدادات الـ OTP – كل حاجة خاصة بالـ OTP موجودة في الملف ده بس.
 *
 * الوضع الحالي على staging: الـ OTP ثابت 9999 (OTP_MODE=fixed) وده الافتراضي.
 * لو رجع في يوم كود حقيقي على WhatsApp: اكتبي OTP_MODE=whatsapp في .env (أو غيّري DEFAULT_MODE تحت).
 * وكمان فيه هنا كود الـ 2FA (Google Authenticator) لشاشة /sign-in/verify-mfa.
 */
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';
import { Page } from '@playwright/test';

/** نوعين الـ OTP: whatsapp (كود حقيقي) أو fixed (9999) */
export type OtpMode = 'whatsapp' | 'fixed';

/**
 * الوضع الافتراضي لو OTP_MODE مش متكتب في .env.
 * staging دلوقتي ثابت على 9999، فالافتراضي 'fixed'.
 */
const DEFAULT_MODE: OtpMode = 'fixed';

/** الكود الثابت على staging (9999) – ممكن يتغيّر من OTP_CODE في .env */
export const FIXED_OTP = process.env.OTP_CODE || '9999';

/** الوضع الفعلي اللي التستات شغالة بيه: من OTP_MODE في .env، وإلا DEFAULT_MODE */
export const OTP_MODE: OtpMode = (process.env.OTP_MODE as OtpMode) || DEFAULT_MODE;

/** الملف اللي تكتبي فيه الكود اللي وصل على الواتساب (otp.txt في فولدر المشروع) */
export const OTP_FILE = path.resolve(__dirname, '../../otp.txt');

/** أقصى وقت مستنيين فيه الكود يوصل ويتكتب (OTP_WAIT_SECONDS، الافتراضي 180 ثانية) */
const WAIT_MS = Number(process.env.OTP_WAIT_SECONDS || 180) * 1000;

/** بترجع true لو إحنا على وضع الكود الثابت (fixed) */
export const isFixedOtp = (): boolean => OTP_MODE === 'fixed';

/**
 * بيرجّع كود الـ OTP:
 *  - fixed    → 9999 على طول
 *  - whatsapp → بيستنى لحد ما تكتبي الكود في otp.txt (أو تكتبيه بنفسك في المتصفح لو شغالة headed)
 *               وبيرجّع '' لو انتي كتبتيه في المتصفح بنفسك.
 */
export async function getOtp(page: Page, phone: string, otpPageUrl = /verify-.*otp/): Promise<string> {
  if (isFixedOtp()) {
    return FIXED_OTP;
  }

  try {
    fs.unlinkSync(OTP_FILE);
  } catch {
    /* مفيش ملف قديم */
  }

  console.log(
    `\n📲 OTP اتبعت على WhatsApp للرقم ${phone}\n` +
      `   اكتبي الكود في الملف:  ${OTP_FILE}\n` +
      `   أو اكتبيه بنفسك في المتصفح (لو شغالة npm run test:headed)\n` +
      `   مستني ${WAIT_MS / 1000} ثانية...\n`,
  );

  const start = Date.now();
  while (Date.now() - start < WAIT_MS) {
    if (fs.existsSync(OTP_FILE)) {
      const code = fs.readFileSync(OTP_FILE, 'utf8').replace(/\D/g, '');
      if (code.length >= 4) {
        fs.unlinkSync(OTP_FILE);
        return code;
      }
    }
    // المستخدم كتب الكود في المتصفح بنفسه وعدّى صفحة الـ OTP
    if (!otpPageUrl.test(page.url())) {
      return '';
    }
    await page.waitForTimeout(1000);
  }
  throw new Error(`OTP مكتبش خلال ${WAIT_MS / 1000} ثانية – اكتبيه في otp.txt أو غيّري OTP_MODE=fixed`);
}

/**
 * التستات اللي محتاجة OTP حقيقي جديد (غير تسجيل الدخول الأساسي) بتتعمل skip في وضع whatsapp
 * إلا لو OTP_INTERACTIVE=true – عشان مايبعتش رسايل واتساب كتير.
 */
export const allowExtraOtpTests = (): boolean => isFixedOtp() || process.env.OTP_INTERACTIVE === 'true';

/*
 * 2FA (Google Authenticator) – شاشة /sign-in/verify-mfa
 * لو الحساب مفعّل عليه 2FA، بعد الـ OTP بتظهر شاشة "أدخل رمز المصادقة (6 أرقام)".
 *  - لو PROVIDER_TOTP_SECRET موجود في .env (المفتاح اللي تحت الـ QR) → الكود بيتولّد أوتوماتيك
 *  - غير كده بيستنى الكود في otp.txt زي الـ WhatsApp
 */

/** بيحوّل مفتاح الـ 2FA (مكتوب base32) لـ bytes عشان نحسب منه الكود – دالة داخلية */
function base32Decode(s: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = s.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  let bits = '';
  for (const c of clean) {
    bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/** بيحسب كود Google Authenticator (RFC 6238 TOTP) – 6 أرقام بتتغيّر كل 30 ثانية */
export function totp(secret: string, at = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  const code = ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString();
  return code.padStart(6, '0');
}

/**
 * بيرجّع كود الـ 2FA لشاشة verify-mfa:
 * من PROVIDER_TOTP_SECRET لو موجود، وإلا بيستنى تكتبيه في otp.txt.
 */
export async function getMfaCode(page: Page): Promise<string> {
  const secret = process.env.PROVIDER_TOTP_SECRET;
  if (secret) {
    return totp(secret);
  }
  return getOtp(page, '2FA authenticator', /verify-mfa/);
}
