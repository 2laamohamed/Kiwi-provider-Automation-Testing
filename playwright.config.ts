import { defineConfig, devices } from '@playwright/test';
import { env, AUTH_FILES } from './src/config/env';

/**
 * KIWI – Business Owner (Provider) website – إعدادات Playwright
 * المشروع فيه جزئين (staging-web.mykiwi.vip):
 * - onboarding                : بروفايدر جديد من الصفر (تسجيل + OTP 9999 + إعداد المتجر وداتا معروفة)
 * - provider-setup / provider : كل شاشات البروفايدر على آخر حساب عمله onboarding + حساب الحجوزات
 * القيم (الروابط، الدولة، اللغة...) جاية من src/config/env.ts اللي بيقرا ملف .env
 * التشغيل: README.md
 */
/**
 * التستات اللي مش داخلة في رن البروفايدر العادي:
 *  - @destructive إلا لو RUN_DESTRUCTIVE=true (npm run test:destructive)
 *  - @needs-data إلا لو اتطلبت بالاسم (--grep @needs-data)
 */
function providerExcluded(): RegExp | undefined {
  const asked = process.argv.join(' ');
  const parts: string[] = [];
  if (!env.runDestructive) {
    parts.push('@destructive');
  }
  if (!/@needs-data/.test(asked)) {
    parts.push('@needs-data');
  }
  return parts.length ? new RegExp(parts.join('|')) : undefined;
}

// إعدادات المتصفح لكل المشاريع: Chrome ديسكتوب بشاشة 1440×900
const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } };

export default defineConfig({
  // فولدر التستات الرئيسي (كل مشروع تحت بيحدد الفولدر بتاعه)
  testDir: './tests',
  // staging بطيء (صفحات بتاخد 8-15 ثانية)
  // عشان كده أقصى وقت للتست الواحد 3 دقايق (فيه وقت لإعادة فتح الصفحة لو النت قطع)، وأي expect يستنى لحد 20 ثانية
  timeout: 180_000,
  expect: { timeout: 20_000 },
  // التستات جوه الملف الواحد بتشتغل بالترتيب، وفيه 2 workers بس عشان مانضغطش على staging
  fullyParallel: false,
  workers: 2,
  // staging ساعات بيقطع (ERR_CONNECTION_TIMED_OUT / صفحة مابتحمّلش في دقيقة): أي تست يفشل بيتعاد مرة واحدة.
  // لو نجح في المرة التانية بيظهر "flaky" في التقرير (أصفر) ومش بيتحسب failed.
  retries: 1,
  // التقارير:
  // list = النتيجة في الترمينال، html = تقرير في فولدر playwright-report (npm run report)،
  // json = ملف test-results/results.json لو حد عايز يقرا النتايج من برنامج تاني
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    // بيطبع في آخر الرن كل تست اتعمله skip وسببه
    ['./src/utils/skipReasonReporter.ts'],
  ],
  // إعدادات عامة لكل التستات
  use: {
    // الافتراضي: المتصفح بيفتح قدامك وانت شايف كل خطوة (headed).
    // من غير ما المتصفح يبان (headless – أسرع وده المناسب للـ CI): HEADLESS=true
    // أو: npm run test:headless
    headless: process.env.HEADLESS === 'true',
    // اللغة والتوقيت: عربي مصري (أو إنجليزي لو اللغة في .env مش ar) وتوقيت القاهرة
    locale: env.locale === 'ar' ? 'ar-EG' : 'en-US',
    timezoneId: 'Africa/Cairo',
    // أقصى وقت لأي ضغطة/كتابة = 20 ثانية، ولفتح أي صفحة = 60 ثانية
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
    // لو التست فشل بس: بنحتفظ بالـ trace والسكرين شوت والفيديو عشان نعرف حصل إيه
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // onboarding: بروفايدر جديد من الصفر (تسجيل برقم جديد + OTP 9999 + إعداد المتجر والفرع والخدمة والعامل)
    // مش محتاج أي لوجين قبله – بيعمل الحساب بنفسه ويحفظ السيشن في AUTH_FILES.newProvider
    {
      name: 'onboarding',
      testDir: './tests/onboarding',
      // خطوات الأونبوردنج ورا بعض على نفس الحساب (مش بتتعاد لو فشلت عشان ماتعملش حساب/متجر تاني)
      retries: 0,
      use: { ...desktop, baseURL: env.provider.baseURL },
    },
    // موقع الـ Business Owner (البروفايدر)
    // provider-setup: بيعمل لوجين بالـ OTP مرة واحدة ويحفظ السيشن في ملف (AUTH_FILES.provider)
    {
      name: 'provider-setup',
      testMatch: /provider\/auth\.setup\.ts/,
      use: { ...desktop, baseURL: env.provider.baseURL },
    },
    // provider: كل تستات tests/provider، بتستخدم السيشن المحفوظ فمش محتاجة لوجين تاني
    // وبتستنى provider-setup يخلص الأول
    // الحساب = آخر حساب عمله onboarding (التفاصيل في tests/provider/auth.setup.ts)
    // التستات اللي عليها @destructive (بتغيّر داتا حقيقية) أو @needs-data (محتاجة داتا مش موجودة في الحساب الجديد:
    // طلبات، فواتير خطة مدفوعة، رصيد في المحفظة) مش بتشتغل في الرن العادي – مش بتظهر skip، مش داخلة أصلاً.
    // تشغيلها: npm run test:destructive  أو  npx playwright test --project=provider --grep @needs-data
    {
      name: 'provider',
      testDir: './tests/provider',
      testIgnore: /auth\.setup\.ts/,
      dependencies: ['provider-setup'],
      grepInvert: providerExcluded(),
      use: {
        ...desktop,
        baseURL: env.provider.baseURL,
        storageState: AUTH_FILES.provider,
        // بنسمح بالإشعارات عشان نافذة/بانر "تفعيل الإشعارات" مايظهروش فوق الصفحات
        permissions: ['notifications'],
      },
    },
  ],
});
