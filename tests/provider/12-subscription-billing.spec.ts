// تستات صفحة الفواتير والاشتراك وصفحة الخطط.
// الشاشات: الفواتير والاشتراك  /subscription  (خطتك الحالية، معلومات الفوترة، الفواتير، إلغاء الاشتراك)
// ،  اختر خطتك  /pricing  (شهري/سنوي، مقارنة الميزات، الترقية)  ،  والخدمات  /services?scope=allBranches للباقة المجانية.
// User stories: 6003، 6008، 6013، 6143، 6146، 6154، 6134.
// الحساب: حساب onboarding على الخطة المجانية. التستات اللي محتاجة خطة مدفوعة (فواتير، معلومات فوترة، إلغاء)
// عليها @needs-data ومش داخلة في الرن العادي (تتشغّل لما يبقى فيه حساب على خطة مدفوعة).
// تست إلغاء الاشتراك الحقيقي @destructive بيشتغل بس مع npm run test:destructive
// وكمان لازم ALLOW_CANCEL_SUBSCRIPTION=true. تست الترقية بيوصل للـ checkout بس من غير دفع.
import { test, expect } from '../../src/fixtures/provider.fixture';
import { env } from '../../src/config/env';
import { toLatinDigits, parseNumber } from '../../src/utils/data';
import { content } from '../../src/utils/content';

// helper: بيرجّع نص الـ main كله بأرقام إنجليزي، وكل سطر مفصول بـ " | " عشان البحث بالـ regex يبقى أسهل.
async function body(page: import('@playwright/test').Page): Promise<string> {
  return toLatinDigits(await content(page).innerText()).replace(/\n+/g, ' | ');
}

// مجموعة تستات صفحة الفواتير والاشتراك.
test.describe('Billing & Subscription page', () => {
  // قبل كل تست: افتح /subscription واستنى كارت "خطتك الحالية".
  test.beforeEach(async ({ subscription }) => {
    await subscription.goto();
  });

  // US 6143: عنوان الصفحة (title في التاب) لازم يكون "الفواتير والاشتراك".
  test('menu & page title are "الفواتير والاشتراك" (US 6143)', async ({ page }) => {
    await expect(page).toHaveTitle(/الفواتير والاشتراك/);
  });

  // US 6146: كارت "خطتك الحالية" لازم فيه: الحالة (نشط/ملغي/منتهي)، السعر بالعملة لكل شهر/سنة أو "مجاني"،
  // والاستهلاك (الفروع / العاملين) المستخدم لازم يكون أقل من أو يساوي الحد.
  test('current plan card: name, status, price per cycle, usage (US 6146)', async ({ page }) => {
    const t = await body(page);
    expect(t).toMatch(/خطتك الحالية/);
    expect(t).toMatch(/نشط|ملغي|منتهي/);
    expect(t).toMatch(/[\d,.]+\s*\|\s*(L\.E|SAR|AED)\s*\|\s*\/\s*(سنة|شهر)|مجاني/);
    for (const m of t.matchAll(/(الفروع|العاملين)\s*\|\s*(\d+)\s*\/\s*(\d+)/g)) {
      expect(Number(m[2]), `${m[1]} used ≤ limit`).toBeLessThanOrEqual(Number(m[3]));
    }
  });

  // US 6003 / 6146: "عرض جميع الخطط" بيودّي لـ /pricing وفيها بادج "الخطة الحالية" على الخطة المجانية.
  test('upgrade CTA "عرض جميع الخطط" opens pricing with the current plan marked (US 6003 / 6146)', async ({
    page,
  }) => {
    await page.getByRole('link', { name: 'عرض جميع الخطط' }).click();
    await expect(page).toHaveURL(/pricing/);
    await expect(page.getByText('الخطة الحالية').first()).toBeVisible();
  });

  // الخطة المجانية (حساب onboarding): مفيش فواتير ("لا توجد فواتير") ومفيش زرار "إلغاء الاشتراك"،
  // ومعلومات الفوترة فاضية (-).
  test('free plan: no invoices, no cancel button, empty billing info', async ({ page }) => {
    const t = await body(page);
    expect(t).toMatch(/مجاني/);
    expect(t).toMatch(/لا توجد فواتير/);
    expect(t).toMatch(/تاريخ الفاتورة التالية\s*\|\s*-/);
    await expect(page.getByRole('button', { name: 'إلغاء الاشتراك' })).toHaveCount(0);
  });

  // معلومات الفوترة: تاريخ الفاتورة التالية في المستقبل، الكارت متخبي (**** **** **** 1234)،
  // والمبلغ = سعر الخطة. على الباقة المجانية (مفيش معلومات فوترة) بيتعمل skip.
  test('billing info: next invoice date in the future, masked card, amount = plan price @needs-data', async ({
    page,
  }) => {
    const t = await body(page);
    test.skip(!/معلومات الفوترة/.test(t), 'Free plan – no billing info');
    const next = t.match(/تاريخ الفاتورة التالية\s*\|\s*[^|]*?(\d{2})-(\d{2})-(\d{4})/);
    if (next) {
      expect(new Date(Number(next[3]), Number(next[2]) - 1, Number(next[1])).getTime()).toBeGreaterThan(
        Date.now(),
      );
    }
    expect(t).toMatch(/\*{4}\s*\*{4}\s*\*{4}\s*\d{4}/);
    const planPrice = parseNumber(t.match(/نشط\s*\|\s*([\d,.]+)/)?.[1] ?? 'NaN');
    const billAmount = parseNumber(
      t.match(/المبلغ\s*\|\s*([\d,.]+)\s*\|\s*(L\.E|SAR|AED)\s*\|\s*\//)?.[1] ?? 'NaN',
    );
    expect(billAmount).toBe(planPrice);
  });

  // US 6008: كل صف في جدول الفواتير لازم فيه: رقم INV-…، النوع (شهري/سنوي)، المبلغ بالعملة،
  // التاريخ dd-mm-yyyy، والحالة (مدفوعة / غير مدفوعة / مستردة / فاشلة). لو مفيش فواتير بيتعمل skip.
  test('invoices table: id INV-…, type, plan, amount + currency, date, status (US 6008) @needs-data', async ({
    page,
  }) => {
    const rows = content(page).locator('table tbody tr');
    test.skip((await rows.count()) === 0, 'No invoices');
    for (const r of (await rows.allInnerTexts()).map(toLatinDigits)) {
      expect(r).toMatch(/INV-\d+/);
      expect(r).toMatch(/شهري|سنوي/);
      expect(r).toMatch(/[\d.]+\s*(L\.E|SAR|AED)/);
      expect(r).toMatch(/\d{2}-\d{2}-\d{4}/);
      expect(r).toMatch(/مدفوعة|غير مدفوعة|مستردة|فاشلة/);
    }
  });

  // مرتبط ببج معروف: الفاتورة INV-033 طلعت 2016.44 بدل 3000 (سعر الخطة).
  // المتوقع: كل فاتورة لنفس الخطة مبلغها = سعر الخطة الحالية.
  test('full-cycle invoice amount equals the plan price (BUG: INV-033 2016.44 vs 3000) @needs-data', async ({
    page,
  }) => {
    const t = await body(page);
    const plan = t.match(/خطتك الحالية[\s\S]*?\|\s*([^|]+?)\s*\|\s*نشط\s*\|\s*([\d,.]+)/);
    test.skip(!plan, 'Plan not readable');
    const rows = (await content(page).locator('table tbody tr').allInnerTexts()).map(toLatinDigits);
    const sameCycle = rows.filter((r) => r.includes(plan![1].trim()));
    for (const r of sameCycle) {
      const amount = parseNumber(r.match(/([\d.]+)\s*(L\.E|SAR|AED)/)?.[1] ?? 'NaN');
      expect(amount, `${r} vs plan ${plan![2]}`).toBeCloseTo(parseNumber(plan![2]), 0);
    }
  });

  // US 6154: زرار "تنزيل الفاتورة" لازم ينزّل ملف PDF حقيقي (يبدأ بـ %PDF) ومكتوب فيه MoonTech.
  test('invoice download is a PDF issued by MoonTech (US 6154) @needs-data', async ({ page }) => {
    const dl = page.getByRole('button', { name: 'تنزيل الفاتورة' }).first();
    test.skip((await dl.count()) === 0, 'No invoices');
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), dl.click()]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    const fs = await import('fs');
    const buf = fs.readFileSync((await download.path())!);
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
    expect(buf.toString('latin1')).toMatch(/MoonTech/i);
  });

  // US 6013: "إلغاء الاشتراك" بيفتح تأكيد فيه "سينتهي اشتراكك بعد الفترة المدفوعة الحالية".
  // الضغط على "الاحتفاظ بالاشتراك" يقفل الـ popup والحالة تفضل "نشط". مش بيلغي حاجة.
  test('cancel subscription: confirmation explains the effect; "keep" closes it (US 6013) @needs-data', async ({
    page,
  }) => {
    const cancel = page.getByRole('button', { name: 'إلغاء الاشتراك' });
    test.skip((await cancel.count()) === 0, 'Free plan – nothing to cancel');
    await cancel.click();
    const dlg = page.getByRole('dialog').or(page.getByRole('alertdialog')).last();
    await expect(dlg).toContainText('سينتهي اشتراكك بعد الفترة المدفوعة الحالية');
    await dlg.getByRole('button', { name: 'الاحتفاظ بالاشتراك' }).click();
    await expect(dlg).toBeHidden();
    await expect(page.getByText('نشط').first()).toBeVisible();
  });

  // @destructive (بيلغي الاشتراك فعلًا!): بيشتغل بس مع npm run test:destructive و ALLOW_CANCEL_SUBSCRIPTION=true.
  // المتوقع الحالة تتغير (تم إلغاء / ملغي / ينتهي في) والفواتير القديمة تفضل موجودة.
  test('cancel subscription end-to-end → status changes, invoices stay @destructive', async ({ page }) => {
    test.skip(!env.runDestructive, 'Cancels the subscription');
    test.skip(
      process.env.ALLOW_CANCEL_SUBSCRIPTION !== 'true',
      'Set ALLOW_CANCEL_SUBSCRIPTION=true to really cancel',
    );
    await page.getByRole('button', { name: 'إلغاء الاشتراك' }).click();
    await page
      .getByRole('dialog')
      .or(page.getByRole('alertdialog'))
      .last()
      .getByRole('button', { name: 'إلغاء الاشتراك' })
      .click();
    await expect(page.getByText(/تم إلغاء|ملغي|ينتهي في/).first()).toBeVisible();
    await expect(page.getByText('الفواتير').first()).toBeVisible();
  });
});

// مجموعة تستات صفحة الخطط والترقية  /pricing.
test.describe('Pricing / upgrade flow', () => {
  // التبديل بين شهري وسنوي لازم يغيّر الأسعار المعروضة، وبادج "الخطة الحالية" ظاهر.
  // (لو مفيش خطط مدفوعة – قرار المنتج 02-11: خطة مجانية بس – مفيش أسعار تتغيّر، فالتست بيتعمل skip)
  test('monthly ⇄ yearly toggle changes prices; current plan badge', async ({ pricing, page }) => {
    await pricing.goto();
    test.skip(
      (await pricing.paidPlanCount()) === 0,
      'No paid plans on staging right now (product decision 02-11: free plan only)',
    );
    await pricing.toggle('monthly').click();
    await expect(page.getByText('/ شهر').first()).toBeVisible();
    const m = toLatinDigits(await content(page).innerText());
    await pricing.toggle('yearly').click();
    await expect(page.getByText('/ سنة').first()).toBeVisible();
    const y = toLatinDigits(await content(page).innerText());
    expect(y).not.toBe(m);
    await expect(page.getByText('الخطة الحالية').first()).toBeVisible();
  });

  // US 6146: اختيار خطة مدفوعة (مش الحالية) لازم يودّي لصفحة الدفع/الملخص. التست مش بيدفع.
  // لو الحساب على أعلى خطة بيتعمل skip.
  // (لو مفيش خطط مدفوعة – قرار المنتج 02-11 – التست بيتعمل skip)
  test('choosing a paid plan goes to checkout – NOT paid (US 6146)', async ({ pricing, page }) => {
    await pricing.goto();
    test.skip(
      (await pricing.paidPlanCount()) === 0,
      'No paid plans on staging right now (product decision 02-11: free plan only)',
    );
    const choose = content(page)
      .getByRole('button', { name: /^ترقية إلى / })
      .first();
    await expect(choose, 'free plan has upgrade buttons').toBeVisible();
    await choose.click();
    await expect(page).toHaveURL(/pricing\/change\/\d+/, { timeout: 30_000 });
    await expect(page.getByText(/ملخص الطلب|تأكيد الترقية/).first()).toBeVisible({ timeout: 30_000 });
  });

  // US 6134: على الباقة المجانية، الخدمات على "جميع الفروع" مقفولة، وزرار "ترقية الخطة" بيودّي لصفحة الخطط
  // اللي فيها زراير "ترقية إلى …".
  test('free plan: all branches locked + upgrade CTA opens the plans (US 6134)', async ({
    services,
    pricing,
    page,
  }) => {
    await services.goto('allBranches');
    await expect(services.upgradeNote).toBeVisible();
    await services.upgradeCta.click();
    await expect(page).toHaveURL(/pricing/);
    // (قرار المنتج 02-11: الفترة الحالية خطة مجانية بس – لو مفيش خطط مدفوعة بنكتب ملاحظة بدل زراير الترقية)
    if ((await pricing.paidPlanCount()) === 0) {
      test.info().annotations.push({
        type: 'free plan only',
        description:
          'Services "all branches" still asks to upgrade, but /pricing has no paid plan to upgrade to',
      });
      return;
    }
    await expect(
      content(page)
        .getByRole('button', { name: /^ترقية إلى / })
        .first(),
    ).toBeVisible();
  });
});
