// تستات التقارير للبروفايدر.
// الشاشات: التقارير  /reports  (الصفحة الرئيسية للتقارير + زرار "عرض التقارير التفصيلية")
// و 11 تقرير تفصيلي  /reports/<slug>  (زي net-revenue و peak-hours و average-order-value ...).
// User stories: Reports overview + 11 detailed reports.
// بيتأكد إن كل تقرير بيفتح من غير crash ولا null، وإن الأسبوعي/الشهري والـ breadcrumb شغالين.
import { test, expect } from '../../src/fixtures/provider.fixture';
import { REPORT_SLUGS } from '../../src/pages/provider/FinancePages';
import { AR_MONTHS } from '../../src/utils/texts';
import { expectNoRawI18nKeys, expectNoNullText } from '../../src/utils/pageHealth';
import { content } from '../../src/utils/content';

// مجموعة تستات التقارير.
test.describe('Reports', () => {
  // صفحة التقارير الرئيسية بتفتح من غير مفاتيح ترجمة خام ولا errors.
  test('reports overview loads @smoke', async ({ reports, health, page }) => {
    await reports.goto();
    await expectNoRawI18nKeys(page);
    await health.expectHealthy();
  });

  // تست لكل تقرير تفصيلي من الـ 11: يفتح من غير ما يرجع لـ sign-in، ومن غير null أو crash.
  // تقرير average-order-value (AOV) كان بيقع بـ "Application error" على staging، فبنضيف له annotation.
  for (const slug of REPORT_SLUGS) {
    test(`detailed report "${slug}" opens without crash`, async ({ reports, health, page }) => {
      if (slug === 'average-order-value') {
        test.info().annotations.push({
          type: 'issue',
          description: 'AOV report crashed with Application error on staging',
        });
      }
      await reports.gotoReport(slug);
      await expect(page).not.toHaveURL(/sign-in/);
      await expectNoRawI18nKeys(page);
      await expectNoNullText(page);
      await health.expectHealthy();
    });
  }

  // في التقرير التفصيلي (ساعات الذروة): "شهري" هو الافتراضي، والضغط على "أسبوعي" بيغيّر الفترة في الرابط
  // (period=weekly) والصفحة متقعش.
  test('weekly / monthly period tabs work on a detailed report', async ({ reports, page, health }) => {
    await reports.gotoReport('peak-hours');
    await expect(reports.periodTab('monthly')).toHaveAttribute('aria-selected', 'true');
    await reports.periodTab('weekly').click();
    await expect(reports.periodTab('weekly')).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/period=weekly/);
    await reports.periodTab('monthly').click();
    await expect(page).toHaveURL(/period=monthly/);
    await health.expectHealthy();
  });

  // تقرير صافي الإيرادات (net-revenue): أسماء الشهور في الشارت متتكررش (أكتر من مرتين = تكرار غلط).
  test('net revenue chart: month labels are not duplicated', async ({ reports, page }) => {
    await reports.gotoReport('net-revenue');
    await expect(page.getByText(/اتجاه صافي الإيرادات/).first()).toBeVisible({ timeout: 30_000 });
    const text = await content(page).innerText();
    const dupes = AR_MONTHS.filter((m) => (text.match(new RegExp(m, 'g')) ?? []).length > 2);
    expect(dupes, `Month labels repeated in chart: ${dupes.join(', ')}`).toEqual([]);
  });

  // من تقرير peak-hours، الضغط على أول جزء في الـ breadcrumb ("التقارير") لازم يرجّع لـ /reports.
  test('breadcrumb returns to reports overview', async ({ reports, page }) => {
    await reports.gotoReport('peak-hours');
    await reports.breadcrumbRoot.click();
    await expect(page).toHaveURL(/\/reports(\?|$)/);
  });
});
