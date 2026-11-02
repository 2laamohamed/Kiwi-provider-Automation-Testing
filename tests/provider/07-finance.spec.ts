// تستات الشاشات المالية للبروفايدر (تستات أساسية، والتفاصيل الأكتر في ملفات 12 و 13).
// الشاشات: المحفظة  /wallet  ،  الفواتير والاشتراك  /subscription  ،  اختر خطتك  /pricing  ،  الخصومات  /discounts
// User stories: Wallet, Billing & subscription, Pricing plans, Discounts.
// تستات الخصومات بتفتح الـ wizard وبتجرب الفاليديشن بس، مش بتحفظ خصم (إنشاء الخصم في onboarding قسم 8).
import { test, expect } from '../../src/fixtures/provider.fixture';
import { AR } from '../../src/utils/texts';
import { cairoToday } from '../../src/utils/data';
import { expectNoRawI18nKeys, expectNoNullText } from '../../src/utils/pageHealth';
import { DiscountCreator } from '../../src/pages/provider/StoreDataPages';
import { mainProvider } from '../../src/fixtures/qaProvider';

/** اسم فرع الحساب الأساسي (من onboarding) */
const branchName = (): string => mainProvider().branchName;

// مجموعة تستات المحفظة.
test.describe('Wallet', () => {
  // المحفظة بتفتح و"الرصيد الحالي" ظاهر، ومفيش null ولا مفاتيح ترجمة خام.
  test('wallet loads with balances @smoke', async ({ wallet, page, health }) => {
    await wallet.goto();
    await expect(page.getByText(AR.wallet.current).first()).toBeVisible();
    await expectNoRawI18nKeys(page);
    await expectNoNullText(page);
    await health.expectHealthy();
  });

  // "الرصيد المتاح" لازم يكون أقل من أو يساوي "الرصيد الحالي" (والاتنين أرقام مقروءة).
  test('available balance is not greater than current balance', async ({ wallet }) => {
    await wallet.goto();
    const available = await wallet.amountAfter(AR.wallet.available);
    const current = await wallet.amountAfter(AR.wallet.current);
    expect(available, 'available balance').not.toBeNaN();
    expect(current, 'current balance').not.toBeNaN();
    expect(available).toBeLessThanOrEqual(current);
  });

  // الحساب الجديد (onboarding) رصيده 0: المتوقع "طلب التحويل" يبقى disabled.
  test('new account: balance 0 and the transfer button is disabled', async ({ wallet }) => {
    await wallet.goto();
    expect(await wallet.amountAfter(AR.wallet.available)).toBe(0);
    await expect(wallet.transferButton).toBeDisabled();
  });
});

// مجموعة تستات الاشتراك وصفحة الخطط.
test.describe('Subscription & pricing', () => {
  // صفحة الفواتير والاشتراك بتفتح وقسم "الفواتير" ظاهر.
  test('subscription page shows current plan @smoke', async ({ subscription, page, health }) => {
    await subscription.goto();
    await expect(page.getByText(AR.subscription.invoices).first()).toBeVisible();
    await health.expectHealthy();
  });

  // "عرض جميع الخطط" لازم يودّي لصفحة /pricing.
  test('"view all plans" opens pricing', async ({ subscription, page }) => {
    await subscription.goto();
    await page.getByText(AR.subscription.allPlans).first().click();
    await expect(page).toHaveURL(/pricing/);
  });

  // في صفحة اختر خطتك: التبديل سنوي/شهري شغال (الأسعار "/ سنة" و "/ شهر")، وبادج "الخطة الحالية" ظاهر،
  // ومفيش مفاتيح ترجمة خام.
  // (لو مفيش خطط مدفوعة – قرار المنتج 02-11 – مفيش أسعار "/ سنة" و "/ شهر" أصلاً، فبنتأكد من التبديل والبادج بس)
  test('pricing monthly/yearly toggle and current plan badge', async ({ pricing, page, health }) => {
    await pricing.goto();
    const paid = await pricing.paidPlanCount();
    await pricing.toggle('yearly').click();
    if (paid) {
      await expect(page.getByText('/ سنة').first()).toBeVisible();
    }
    await pricing.toggle('monthly').click();
    if (paid) {
      await expect(page.getByText('/ شهر').first()).toBeVisible();
    } else {
      test
        .info()
        .annotations.push({
          type: 'free plan only',
          description: 'No paid plans on staging right now (product decision 02-11: free plan only)',
        });
    }
    await expect(page.getByText(AR.pricing.currentPlanBadge).first()).toBeVisible();
    await expectNoRawI18nKeys(page);
    await health.expectHealthy();
  });
});

// مجموعة تستات الخصومات (wizard "إضافة خصم جديد").
test.describe('Discounts', () => {
  // صفحة الخصومات بتفتح وزرار "إضافة خصم جديد" ظاهر.
  test('discounts page loads @smoke', async ({ discounts, health }) => {
    await discounts.goto();
    await expect(discounts.addButton).toBeVisible();
    await health.expectHealthy();
  });

  // الضغط على "التالي" من غير اختيار فرع: المتوقع "يرجى تحديد فرع واحد على الأقل".
  test('wizard requires at least one branch', async ({ discounts }) => {
    await discounts.goto();
    const dlg = await discounts.openWizard();
    await dlg.getByRole('button', { name: AR.discounts.next }).click();
    await expect(dlg.getByText(AR.discounts.selectBranchError).first()).toBeVisible();
  });

  // نسبة خصم 150%: المتوقع رسالة "يجب أن تكون قيمة النسبة المئوية أقل من 100".
  test('percentage ≥ 100 is rejected', async ({ discounts, page }) => {
    await discounts.goto();
    const w = new DiscountCreator(page);
    await w.open();
    await w.selectBranch(branchName());
    await w.next.click();
    await w.dialog.locator('input[name="value"]').fill('150');
    await w.next.click();
    await expect(w.dialog.getByText(AR.discounts.percentError).first()).toBeVisible();
  });

  // تاريخ البداية = تاريخ النهاية (النهارده): المتوقع "يجب أن يكون تاريخ النهاية بعد تاريخ البداية".
  test('end date must be after the start date', async ({ discounts, page }) => {
    test.info().annotations.push({ type: 'note', description: `today (Cairo) = ${cairoToday()}` });
    await discounts.goto();
    const w = new DiscountCreator(page);
    await w.open();
    await w.selectBranch(branchName());
    await w.next.click();
    await w.fillDetails(`QA${Date.now().toString().slice(-6)}`, '10', 0, 0);
    await w.next.click();
    await expect(w.dialog.getByText('يجب أن يكون تاريخ النهاية بعد تاريخ البداية').first()).toBeVisible();
  });
});
