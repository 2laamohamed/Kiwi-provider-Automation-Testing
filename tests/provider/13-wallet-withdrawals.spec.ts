// تستات المحفظة وطلبات السحب (التحويل) للبروفايدر.
// الشاشات: المحفظة  /wallet  (الرصيد المتاح، الرصيد الحالي، طلب التحويل، آخر المعاملات)
// ،  المعاملات  /transactions  ،  وpopup "طلب التحويل" وإضافة حساب بنكي.
// User story: US 6046 – لازم OTP قبل أي إجراء مالي حساس (سحب / إضافة أو تعديل أو حذف حساب بنكي).
// الحساب: حساب onboarding (رصيده 0). التستات اللي محتاجة رصيد أو سحب معلّق عليها @needs-data ومش داخلة في الرن العادي.
// تست السحب الكامل @destructive بيعمل طلب سحب حقيقي بـ 1، وبيشتغل بس مع npm run test:destructive.
import { test, expect } from '../../src/fixtures/provider.fixture';
import { env } from '../../src/config/env';
import { AR } from '../../src/utils/texts';
import { toLatinDigits, parseNumber } from '../../src/utils/data';
import { getOtp } from '../../src/config/otp';
import { content } from '../../src/utils/content';
import { mainProvider } from '../../src/fixtures/qaProvider';

// regex للعملات اللي ممكن تظهر في المحفظة (جنيه / ريال / درهم بالإنجليزي والعربي).
const CUR = /L\.E|EGP|SAR|AED|ر\.س|د\.إ|ج\.م/;

// مجموعة تستات صفحة المحفظة (قراءة بس، مفيش تغيير داتا).
test.describe('Wallet', () => {
  // قبل كل تست: افتح صفحة المحفظة.
  test.beforeEach(async ({ wallet }) => {
    await wallet.goto();
  });

  // الرصيد المتاح لازم يكون أقل من أو يساوي الرصيد الحالي، والأرقام ظاهرة بعملة.
  test('balances shown with currency; available ≤ current @smoke', async ({ wallet, page }) => {
    const available = await wallet.amountAfter(AR.wallet.available);
    const current = await wallet.amountAfter(AR.wallet.current);
    expect(available).toBeLessThanOrEqual(current);
    await expect(content(page)).toContainText(CUR);
  });

  // (الرصيد الحالي − الرصيد المتاح) لازم يساوي مجموع طلبات السحب "قيد الانتظار" في صفحة المعاملات.
  // لو مفيش سحب معلّق والفرق صفر بيتعمل skip.
  test('current − available = pending withdrawals of this branch @needs-data', async ({ wallet, page }) => {
    const diff =
      (await wallet.amountAfter(AR.wallet.current)) - (await wallet.amountAfter(AR.wallet.available));
    await page.goto('/transactions');
    const t = toLatinDigits(await content(page).innerText());
    const pending = [
      ...t.matchAll(/سحب[^\n]*\n[\s\S]{0,80}?(\d[\d,.]*)\s*\n?\s*L\.E[\s\S]{0,40}?قيد الانتظار/g),
    ].reduce((a, m) => a + parseNumber(m[1]), 0);
    test.skip(pending === 0 && diff === 0, 'No pending withdrawals');
    expect(diff).toBeCloseTo(pending, 1);
  });

  // إشارة المعاملات: الطلب والموعد لازم بـ "+"، والاسترداد والسحب والعمولة لازم بـ "−".
  test('transactions: + for appointments/orders, − for refunds/withdrawals/commission', async ({ page }) => {
    const t = toLatinDigits(await content(page).innerText());
    for (const m of t.matchAll(/(طلب|موعد|استرداد|سحب|عمولة)\s*#\d+[\s\S]{0,60}?([+-])\s*([\d,.]+)/g)) {
      const [, type, sign] = m;
      if (/طلب|موعد/.test(type)) {
        expect(sign, m[0]).toBe('+');
      }
      if (/استرداد|سحب|عمولة/.test(type)) {
        expect(sign, m[0]).toBe('-');
      }
    }
  });

  // التبديل بين "جميع الفروع" و"الفرع الحالي" شغال، ولينك "عرض الكل" بيودّي لـ /transactions من غير errors.
  test('"current branch / all branches" switch and "view all" open', async ({ page, health }) => {
    await page.getByRole('button', { name: 'جميع الفروع' }).click();
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: 'الفرع الحالي' }).click();
    await page.getByRole('link', { name: 'عرض الكل' }).first().click();
    await expect(page).toHaveURL(/transactions/);
    await health.expectHealthy();
  });
});

// مجموعة تستات popup "طلب التحويل" (السحب). كلها فاليديشن ومش بتكمّل سحب، ما عدا تست @destructive.
// @needs-data: محتاجة رصيد في المحفظة (حساب onboarding رصيده 0 والزرار disabled – ده متغطي في 07-finance).
test.describe('Transfer request (withdrawal) @needs-data', () => {
  // قبل كل تست: افتح المحفظة وافتح popup طلب التحويل. لو الزرار disabled (مفيش رصيد) بيتعمل skip.
  test.beforeEach(async ({ wallet }) => {
    await wallet.goto();
    test.skip(await wallet.transferButton.isDisabled(), 'Transfer disabled (no balance)');
    await wallet.openTransfer();
  });

  // أزرار المبالغ السريعة: الضغط على 200 لازم يكتب 200 في حقل المبلغ.
  test('quick amount buttons fill the amount', async ({ wallet, page }) => {
    const d = wallet.transferDialog;
    await d.quick(200).click();
    await expect(d.amount).toHaveValue(/200/);
  });

  // مبلغ أكبر من الرصيد المتاح (99999999): المتوقع رسالة "أكبر من / غير كافٍ / يتجاوز".
  test('amount greater than available is rejected', async ({ wallet, page }) => {
    const d = wallet.transferDialog;
    await d.amount.fill('99999999');
    await d.accounts
      .first()
      .check()
      .catch(() => d.accounts.first().click());
    await d.submit.click();
    await expect(d.dialog.getByText(/أكبر من|غير كافٍ|يتجاوز|الرصيد المتاح/).first()).toBeVisible();
  });

  // مبلغ صفر: المتوقع رسالة خطأ (غير صالح / مطلوب / الحد الأدنى).
  test('zero / empty amount is rejected', async ({ wallet, page }) => {
    const d = wallet.transferDialog;
    await d.amount.fill('0');
    await d.submit.click();
    await expect(d.dialog.getByText(/أكبر من|غير صالح|مطلوب|الحد الأدنى/).first()).toBeVisible();
  });

  // إرسال طلب من غير اختيار حساب بنكي: المتوقع رسالة "اختر الحساب / مطلوب".
  test('a bank account must be selected', async ({ wallet, page }) => {
    const d = wallet.transferDialog;
    await d.amount.fill('1');
    await d.submit.click();
    await expect(d.dialog.getByText(/اختر|الحساب|مطلوب/).first()).toBeVisible();
  });

  // مرتبط ببج معروف: بنك سعودي كان بيقبل IBAN مصري بيبدأ بـ "eg".
  // المتوقع: إضافة حساب بنكي بـ IBAN غلط تظهر رسالة "IBAN / آيبان / غير صالح".
  test('add bank account: IBAN is validated (BUG: Saudi bank accepts "eg…" IBAN)', async ({
    wallet,
    page,
  }) => {
    const d = wallet.transferDialog;
    await d.addAccount.click();
    const form = page.getByRole('dialog').last();
    const iban = form.locator('input[name*="iban" i]').first();
    await iban.fill('eg1246677776464646647');
    await form
      .getByRole('button', { name: /حفظ|إضافة|التالي/ })
      .last()
      .click();
    await expect(form.getByText(/IBAN|آيبان|غير صالح/).first()).toBeVisible();
  });

  // US 6046: طلب سحب صحيح بـ 1 لازم يطلب OTP الأول (واتساب / تطبيق المصادقة). التست بيقفل بـ Escape ومش بيكمّل.
  test('submitting a valid request asks for OTP first (US 6046) – not completed', async ({
    wallet,
    page,
  }) => {
    const d = wallet.transferDialog;
    await d.amount.fill('1');
    await d.accounts.first().click();
    await d.submit.click();
    await expect(page.getByText(/رمز التحقق|OTP|واتساب|WhatsApp|تطبيق المصادقة/).first()).toBeVisible();
    await page.keyboard.press('Escape');
  });

  // @destructive (بيعمل طلب سحب حقيقي بـ 1، بيشتغل بس مع npm run test:destructive):
  // بيكمّل السحب بالـ OTP. المتوقع رسالة "بنجاح / قيد الانتظار" والرصيد المتاح يقل 1.
  test('withdraw 1 unit end-to-end: available −1, request pending @destructive', async ({ wallet, page }) => {
    test.skip(!env.runDestructive, 'Creates a withdrawal request');
    await page.keyboard.press('Escape');
    const before = await wallet.amountAfter(AR.wallet.available);
    await wallet.transferButton.click();
    const d = wallet.transferDialog;
    await d.amount.fill('1');
    await d.accounts.first().click();
    await d.submit.click();
    const otpBox = page.locator('input[autocomplete="one-time-code"], input[inputmode="numeric"]').last();
    await otpBox.click();
    await page.keyboard.type(await getOtp(page, mainProvider().phone, /.*/));
    await page
      .getByRole('button', { name: /تأكيد|تحقق/ })
      .last()
      .click();
    await expect(page.getByText(/بنجاح|قيد الانتظار/).first()).toBeVisible();
    await wallet.goto();
    expect(await wallet.amountAfter(AR.wallet.available)).toBeCloseTo(before - 1, 1);
  });
});
