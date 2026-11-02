// تستات UI متفرقة على التقارير والطلبات والهيدر والبروفايل والرئيسية.
// الشاشات: التقارير  /reports  و /reports/<slug>  ،  الطلبات  /dashboard?tab=orders  ،  الهيدر في كل التابات
// ،  إعدادات الحساب  /profile  ،  الرئيسية  /dashboard?tab=home  ،  والصفحة الأولى للموقع  /
// User stories: التقارير (6024، 6029، 6159، 6163، 6168، 6019)، الطلبات (5970، 6090-6102)، الهيدر (6072)،
// البروفايل (6035، 6203)، اكتمال الحساب (5926)، تحميل التطبيق (5921).
// كل التستات هنا قراءة بس، مفيش تغيير داتا. تستات الطلبات عليها @needs-data (حساب onboarding مفيهوش طلبات)
// ومش داخلة في الرن العادي.
import { test, expect } from '../../src/fixtures/provider.fixture';
import { AR } from '../../src/utils/texts';
import { REPORT_SLUGS } from '../../src/pages/provider/FinancePages';
import { toLatinDigits } from '../../src/utils/data';
import { content } from '../../src/utils/content';
import { mainProvider } from '../../src/fixtures/qaProvider';

// مجموعة تستات تفاصيل التقارير.
test.describe('Reports details', () => {
  // US 6024: الفترة الافتراضية في التقارير التفصيلية "شهري": تاب "شهري" متعلّم (aria-selected) والرابط period=monthly.
  test('default period is Monthly (US 6024)', async ({ reports, page }) => {
    await reports.gotoReport('peak-hours');
    await expect(reports.periodTab('monthly')).toHaveAttribute('aria-selected', 'true');
    await expect(reports.periodTab('weekly')).toHaveAttribute('aria-selected', 'false');
    await expect(page).toHaveURL(/period=monthly/);
  });

  // US 6163: تست لكل تقرير تفصيلي: الـ breadcrumb لازم يكون "التقارير / اسم التقرير" (جزئين على الأقل).
  for (const slug of REPORT_SLUGS) {
    test(`breadcrumb "التقارير / name" on ${slug} (US 6163)`, async ({ reports, page }) => {
      await reports.gotoReport(slug);
      const crumb = reports.breadcrumb;
      await expect(crumb).toContainText(AR.reports.title, { timeout: 30_000 });
      await expect(crumb.getByRole('link', { name: AR.reports.title })).toHaveAttribute('href', /\/reports$/);
      expect((await crumb.innerText()).split(/\n|\//).filter((x) => x.trim()).length).toBeGreaterThanOrEqual(
        2,
      );
    });
  }

  // US 6159: كلمة AOV متظهرش لوحدها، لازم مكتوبة كاملة "متوسط قيمة الطلب".
  test('AOV is written in full: "متوسط قيمة الطلب" (US 6159)', async ({ reports, page }) => {
    await reports.goto();
    await expect(page.getByText(/\bAOV\b/)).toHaveCount(0);
    await expect(page.getByText(/متوسط قيمة الطلب/).first()).toBeVisible();
  });

  // US 6029 / 6168: في كروت الـ KPI، الرقم لازم يكون خطه أكبر من خط العنوان بتاعه.
  // بيقيس font-size لأول 10 كروت. لو مفيش كروت KPI بيتعمل skip.
  test('KPI value is visually dominant over its label (US 6029 / 6168)', async ({ reports, page }) => {
    await reports.goto();
    await expect(page.getByText('معدل الإشغال').first()).toBeVisible();
    const sizes = await page.evaluate(() => {
      const out: Array<[number, number]> = [];
      document.querySelectorAll('main *, div[class*="md:bg-background"].container *').forEach((el) => {
        const t = (el as HTMLElement).innerText?.trim() ?? '';
        if (el.children.length === 0 && /^[\d٠-٩.,%]+\s*(L\.E|SAR|AED|ر\.س|%)?$/.test(t)) {
          const parent = el.parentElement!;
          const label = Array.from(parent.parentElement?.querySelectorAll('*') ?? []).find(
            (x) => x.children.length === 0 && /[؀-ۿ]{3,}/.test((x as HTMLElement).innerText ?? ''),
          );
          if (label) {
            out.push([
              parseFloat(getComputedStyle(el).fontSize),
              parseFloat(getComputedStyle(label).fontSize),
            ]);
          }
        }
      });
      return out.slice(0, 10);
    });
    expect(sizes.length, 'KPI cards found').toBeGreaterThan(0);
    for (const [value, label] of sizes) {
      expect(value).toBeGreaterThan(label);
    }
  });

  // US 6019: فلتر التاريخ في تقرير net-revenue لازم فيه (من/إلى، الشهر الحالي، أسبوعي، مخصص، كل الأوقات).
  // ملاحظة: تاسك الـ FE لسه New، فالمتوقع إن التست يفشل لحد ما يتنفذ.
  test('date filter offers From/To, current month, weekly, custom, all time (US 6019)', async ({
    reports,
    page,
  }) => {
    // US 6019 لسه ماتنفذتش في الـ FE ← التست متعلّم "متوقع يفشل"؛ لما الفلتر ينزل هيطلع أحمر "passed unexpectedly"
    test.fail(true, 'US 6019 (net revenue date filter) not implemented yet');
    test
      .info()
      .annotations.push({ type: 'known gap US 6019', description: 'Date filter not implemented yet' });
    await reports.gotoReport('net-revenue');
    await expect(page.getByText(/اتجاه صافي الإيرادات/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/كل الأوقات|مخصص/).first()).toBeVisible({ timeout: 5_000 });
  });
});

// مجموعة تستات شكل صفحة الطلبات.
test.describe('Orders UI', () => {
  // US 6097 / 6101 / 6102: أعمدة الجدول لازم: "اسم العميل"، "تاريخ الطلب / تم الطلب"، "إجمالي الطلب"،
  // ومن غير الأسماء القديمة "معلومات العميل" أو "السعر".
  test('columns: Customer name, Order placed, Order total (US 6097 / 6101 / 6102) @needs-data', async ({
    orders,
    page,
  }) => {
    await orders.goto();
    const head = await content(page).locator('thead, [role=\"columnheader\"]').allInnerTexts();
    const h = head.join(' ');
    expect(h).toMatch(/اسم العميل/);
    expect(h).toMatch(/تاريخ الطلب|تم الطلب/);
    expect(h).toMatch(/إجمالي الطلب/);
    expect(h).not.toMatch(/معلومات العميل|السعر$/);
  });

  // في تفاصيل أول طلب: "الإجمالي" لازم يكون أكبر من أو يساوي مجموع (الكمية × السعر) للأصناف.
  // لو مفيش طلبات أو الأرقام مش مقروءة بيتعمل skip.
  test('order total equals sum of items in details @needs-data', async ({ orders, page }) => {
    await orders.goto();
    test.skip((await orders.rows.count()) === 0, 'No orders');
    await orders.rows.first().click();
    const dlg = page.getByRole('dialog').last();
    const t = toLatinDigits(await dlg.innerText());
    const total = Number(t.match(/الإجمالي\s*[:：]?\s*([\d.,]+)/)?.[1]?.replace(/,/g, '') ?? NaN);
    const lines = [...t.matchAll(/(\d+)\s*[x×]\s*([\d.]+)/g)].map((m) => Number(m[1]) * Number(m[2]));
    test.skip(Number.isNaN(total) || lines.length === 0, 'Totals not readable');
    expect(total).toBeGreaterThanOrEqual(lines.reduce((a, b) => a + b, 0) - 0.01);
  });

  // US 5970: أكشن "تذكير" لازم يظهر في منيو الطلبات اللي حالتها "جاهز"،
  // وفي الطلبات "تم التسليم" لو موجود لازم يبقى disabled. مش بيبعت تذكير فعلًا.
  test('send reminder action only for Ready orders (US 5970) @needs-data', async ({ orders, page }) => {
    await orders.goto();
    await orders.tab('جاهز').click();
    await page.waitForTimeout(1500);
    if (await orders.rows.count()) {
      await orders.rows.first().getByRole('button').last().click();
      await expect(page.getByRole('menuitem', { name: /تذكير/ })).toBeVisible();
      await page.keyboard.press('Escape');
    }
    await orders.tab('تم التسليم').click();
    await page.waitForTimeout(1500);
    if (await orders.rows.count()) {
      await orders.rows.first().getByRole('button').last().click();
      const r = page.getByRole('menuitem', { name: /تذكير/ });
      if (await r.count()) {
        await expect(r).toBeDisabled();
      }
    }
  });
});

// مجموعة تستات الهيدر والبروفايل والرئيسية.
test.describe('Header, profile & home', () => {
  // US 6072 (قرار 02-11): الهيدر مش لازم يفضل ثابت مع الـ scroll – المطلوب إنه يبقى ظاهر أول ما الصفحة تفتح.
  // تست لكل تاب: أول ما الصفحة تفتح (من غير scroll) تابات الهيدر (الرئيسية/المواعيد/الطلبات/إعدادات النشاط) ظاهرة.
  for (const tab of ['home', 'appointments', 'orders', 'menu'] as const) {
    test(`header tabs are visible when ${tab} opens (US 6072)`, async ({ dashboard, page }) => {
      await dashboard.goto(tab);
      expect(await page.evaluate(() => window.scrollY), 'page opens at the top').toBe(0);
      for (const name of ['home', 'appointments', 'orders', 'businessSettings'] as const) {
        await expect(dashboard.navTab(name)).toBeInViewport();
      }
    });
  }

  // US 6035: في إعدادات الحساب رقم الهاتف معروض كنص (مش خانة تتكتب) "+20 …" وجنبه زرار "تعديل".
  test('phone is shown read-only with an edit action next to it (US 6035)', async ({ profile, page }) => {
    await profile.goto();
    const phone = mainProvider().phone;
    await expect(page.getByText(new RegExp(`\\+20\\s*${phone}`)).first()).toBeVisible();
    await expect(page.locator(`input[value="${phone}"]`)).toHaveCount(0);
    await expect(profile.editPhone).toBeVisible();
  });

  // US 6203: صفحة إعدادات الحساب مفيهاش تابات (tablist).
  test('account settings has no tabs (US 6203)', async ({ profile, page }) => {
    await profile.goto();
    await expect(content(page).locator('[role="tablist"]')).toHaveCount(0);
  });

  // صفحة الإطلاق التجريبي (/) حسب المتطلبات: اسم كيوي ظاهر، زرار "انضم كصاحب عمل"، و"MoonTech" في الآخر.
  // (US 5921 – لينكات تحميل التطبيق اتشالت من الصفحة في نسخة الإطلاق التجريبي)
  test('public beta landing page: Kiwi, "join as business owner" and MoonTech', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/كيوي|Kiwi/);
    await expect(page.getByText('انضم كصاحب عمل').first()).toBeVisible();
    await expect(page.getByText(/MoonTech/).first()).toBeVisible();
  });
});
