/**
 * أدوات بيانات التست: أرقام وأسماء عشوائية، تاريخ النهارده بتوقيت القاهرة،
 * وتحويل الأرقام العربية (٠١٢٣) لإنجليزي وقراءة المبالغ من النص.
 * بتستخدم في الـ page objects والتستات كلها.
 */

/** بيرجّع أرقام عشوائية بالطول المطلوب، مثلاً randomDigits(4) → "3819" */
export function randomDigits(len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) {
    s += Math.floor(Math.random() * 10).toString();
  }
  return s;
}

/** رقم موبايل سعودي عشوائي من غير مفتاح الدولة: 55XXXXXXX (9 أرقام) */
export function randomSaudiPhone(): string {
  return '55' + randomDigits(7);
}

/**
 * رقم موبايل مصري عشوائي للتسجيل (من غير مفتاح الدولة ومن غير الصفر): 1550XXXXXX.
 * الـ OTP على staging ثابت 9999 فأي رقم صالح ينفع.
 * البادئة ممكن تتغيّر من TEST_PHONE_PREFIX في .env (الافتراضي 1550).
 * ملحوظة: اسألي الديف إن staging مابيبعتش رسايل حقيقية وهو على 9999، عشان مانبعتش لأرقام ناس حقيقية.
 */
export function randomEgyptPhone(): string {
  const prefix = process.env.TEST_PHONE_PREFIX || '1550';
  return prefix + randomDigits(10 - prefix.length);
}

/** آخر 6 أرقام من الوقت الحالي – عشان نعمل أسماء مش متكررة */
export function uniqueSuffix(): string {
  return Date.now().toString().slice(-6);
}

/** اسم تست مميّز، مثلاً "QA 482913" – عشان نعرف الداتا اللي التستات عملتها */
export function qaName(prefix = 'QA'): string {
  return `${prefix} ${uniqueSuffix()}`;
}

/** تاريخ النهارده بتوقيت القاهرة بصيغة YYYY-MM-DD */
export function cairoToday(): string {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(now);
}

/** بيحوّل الأرقام العربية (٠١٢٣٤٥٦٧٨٩) لأرقام إنجليزي */
export function toLatinDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/** بيقرا رقم من نص زي "1,234.56" أو "١٬٢٣٤" ويرجّعه number */
export function parseNumber(s: string): number {
  const clean = toLatinDigits(s).replace(/[^\d.\-]/g, '');
  return Number(clean);
}
