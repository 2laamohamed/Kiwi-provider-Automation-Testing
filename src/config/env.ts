/**
 * إعدادات البيئة – بيقرا ملف .env ويجمّع كل الإعدادات في مكان واحد.
 * فيه: لينك موقع البروفايدر على staging، أرقام وحسابات التست،
 * أماكن ملفات السيشن المحفوظة (.auth/) ومفاتيح الدول.
 * لو عايزة تغيّري حساب أو لينك، غيّريه في .env مش هنا.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/** الدول اللي بنستخدمها في التست: السعودية، مصر، الإمارات */
export type CountryCode = 'SA' | 'EG' | 'AE';

/** بيقرا متغيّر من .env، ولو مش موجود أو فاضي بيرجّع القيمة الافتراضية */
function str(name: string, fallback = ''): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

/**
 * كل الإعدادات اللي التستات بتستخدمها:
 * provider = موقع الـ Business Owner، وإعدادات عامة (OTP، اللغة، التستات المدمّرة).
 */
export const env = {
  provider: {
    baseURL: str('PROVIDER_BASE_URL', 'https://staging-web.mykiwi.vip'),
    phone: str('PROVIDER_PHONE'),
    country: str('PROVIDER_COUNTRY', 'EG') as CountryCode,
    /** اسم المتجر بتاع حساب التست زي ما بيظهر في الأدمن (للتستات المربوطة) */
    storeName: str('PROVIDER_STORE_NAME'),
    dataPhone: str('PROVIDER_DATA_PHONE'),
    dataCountry: str('PROVIDER_DATA_COUNTRY', 'EG') as CountryCode,
  },
  otp: str('OTP_CODE', '9999'),
  locale: str('APP_LOCALE', 'ar') as 'ar' | 'en',
  runDestructive: str('RUN_DESTRUCTIVE', 'false').toLowerCase() === 'true',
};

/** أماكن ملفات السيشن المحفوظة (بعد تسجيل الدخول) عشان التستات متعملش login كل مرة */
export const AUTH_FILES = {
  provider: path.resolve(__dirname, '../../.auth/provider.json'),
  /** سيشن البروفايدر الجديد اللي تستات onboarding بتعمله من الصفر */
  newProvider: path.resolve(__dirname, '../../.auth/provider-new.json'),
  /** بيانات البروفايدر الجديد (الرقم، اسم المتجر، رقم الفرع...) – بتتكتب أثناء تستات onboarding */
  newProviderInfo: path.resolve(__dirname, '../../.auth/new-provider.json'),
};

/** مفتاح كل دولة – بنستخدمه عشان نختار الدولة في خانة رقم التليفون */
export const DIAL_CODE: Record<CountryCode, string> = { SA: '+966', EG: '+20', AE: '+971' };
