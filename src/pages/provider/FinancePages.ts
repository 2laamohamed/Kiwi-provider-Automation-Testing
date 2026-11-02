/**
 * Page objects الصفحات المالية في موقع البروفايدر:
 * التقارير /ar/reports (وكل تقرير تفصيلي)، المحفظة /ar/wallet وطلب التحويل،
 * الفواتير والاشتراك /subscription، الخطط والأسعار /ar/pricing، والخصومات /ar/discounts.
 */
import { Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { AR } from '../../utils/texts';
import { parseNumber, toLatinDigits } from '../../utils/data';
import { content } from '../../utils/content';

/** أسماء التقارير التفصيلية زي ما هي في الـ URL: /ar/reports/<slug> */
export const REPORT_SLUGS = [
  'occupation-rate',
  'top-performing',
  'cancellation-no-show',
  'slow-moving-inventory',
  'peak-hours',
  'average-order-value',
  'net-revenue',
  'projected-revenue',
  'top-performing-workers',
  'lowest-performing-workers',
  'team-trends',
] as const;
/** اسم أي تقرير من REPORT_SLUGS */
export type ReportSlug = (typeof REPORT_SLUGS)[number];

/** صفحة التقارير /ar/reports */
export class ReportsPage extends BasePage {
  /** بيفتح صفحة التقارير ويستنى "عرض التقارير التفصيلية" */
  async goto(): Promise<void> {
    await this.open('/ar/reports?scope=currentBranch');
    await expect(this.page.getByText(AR.reports.detailed).first()).toBeVisible();
  }
  /** بيفتح تقرير تفصيلي معيّن /ar/reports/<slug> */
  async gotoReport(slug: ReportSlug): Promise<void> {
    await this.open(`/ar/reports/${slug}?scope=currentBranch`);
  }
  /** كل اللينكات اللي بتودّي لتقارير تفصيلية */
  get detailedLinks(): Locator {
    return this.page.locator('a[href*="/reports/"]');
  }
  /** الـ breadcrumb فوق التقرير التفصيلي: nav اسمه "التنقل في التقارير" وفيه "التقارير / اسم التقرير" */
  get breadcrumb(): Locator {
    return this.page.getByRole('navigation', { name: /التنقل في التقارير|breadcrumb/i }).first();
  }
  /** لينك "التقارير" في الـ breadcrumb (للرجوع) */
  get breadcrumbRoot(): Locator {
    return this.breadcrumb.getByRole('link', { name: AR.reports.title }).first();
  }
  /** تاب الفترة في التقرير التفصيلي: "أسبوعي" / "شهري" (role=tab) */
  periodTab(name: 'weekly' | 'monthly'): Locator {
    return this.page.getByRole('tab', { name: AR.reports[name], exact: true });
  }
}

/** صفحة المحفظة /ar/wallet – الرصيد وطلب التحويل */
export class WalletPage extends BasePage {
  /** بيفتح المحفظة (عرض المعاملات، الفرع الحالي) ويستنى "الرصيد المتاح" */
  async goto(): Promise<void> {
    await this.open('/ar/wallet?view=transaction&scope=currentBranch');
    await expect(this.page.getByText(AR.wallet.available).first()).toBeVisible();
  }
  /** بيقرا أول رقم بعد label معيّن في الصفحة (مثلاً AR.wallet.available) */
  async amountAfter(label: string): Promise<number> {
    const body = toLatinDigits(await this.page.locator('body').innerText());
    const i = body.indexOf(label);
    const m = body.slice(i, i + 60).match(/([\d,]+(?:\.\d+)?)/);
    return m ? parseNumber(m[1]) : NaN;
  }
  /** زرار "طلب التحويل" */
  get transferButton(): Locator {
    return this.page.getByRole('button', { name: AR.wallet.transfer });
  }

  /** نافذة "طلب التحويل": المبلغ، أزرار المبالغ السريعة، الحسابات البنكية، زرار الطلب */
  get transferDialog() {
    const d = this.page.getByRole('dialog').last();
    return {
      dialog: d,
      amount: d.locator('input[name="balance"]'),
      quick: (n: number) => d.getByRole('button', { name: new RegExp(`^${n}\\s*L\\.E`) }),
      accounts: d.getByRole('radio'),
      addAccount: d.getByRole('button', { name: 'إضافة حساب جديد' }),
      submit: d.getByRole('button', { name: 'طلب التحويل' }),
    };
  }

  /** بيفتح نافذة طلب التحويل */
  async openTransfer(): Promise<void> {
    await this.transferButton.click();
    await expect(this.transferDialog.dialog).toBeVisible();
  }
}

/** صفحة "الفواتير والاشتراك" عند البروفايدر /subscription */
export class SubscriptionPage extends BasePage {
  /** بيفتح الصفحة ويستنى كارت "خطتك الحالية" */
  async goto(): Promise<void> {
    await this.open('/subscription');
    await expect(this.page.getByText(AR.subscription.currentPlan).first()).toBeVisible({ timeout: 40_000 });
  }

  /** نص الصفحة كله بأرقام إنجليزي وكل سطر مفصول بـ " | " – أسهل في البحث بالـ regex */
  async text(): Promise<string> {
    return toLatinDigits(await content(this.page).innerText()).replace(/\n+/g, ' | ');
  }

  /** صفوف جدول الفواتير */
  get invoiceRows(): Locator {
    return content(this.page).locator('table tbody tr');
  }
  /** رابط "عرض جميع الخطط" (الترقية) */
  get allPlansLink(): Locator {
    return this.page.getByRole('link', { name: AR.subscription.allPlans });
  }
  /** زرار "إلغاء الاشتراك" (مش موجود في الخطة المجانية) */
  get cancelButton(): Locator {
    return this.page.getByRole('button', { name: 'إلغاء الاشتراك' });
  }
  /** نافذة تأكيد الإلغاء */
  get cancelDialog(): Locator {
    return this.page.getByRole('dialog').or(this.page.getByRole('alertdialog')).last();
  }
  /** زرار "تنزيل الفاتورة" لأول فاتورة */
  get downloadInvoice(): Locator {
    return this.page.getByRole('button', { name: 'تنزيل الفاتورة' }).first();
  }
}

/** صفحة الخطط والأسعار /ar/pricing ("اختر خطتك") */
export class PricingPage extends BasePage {
  /** بيفتح صفحة الأسعار ويستنى عنوان "اختر خطتك" */
  async goto(): Promise<void> {
    await this.open('/ar/pricing');
    await expect(this.page.getByText(AR.pricing.title).first()).toBeVisible();
  }
  /** زرار التبديل بين شهري وسنوي */
  toggle(name: 'monthly' | 'yearly'): Locator {
    return this.page
      .getByRole('button', { name: AR.pricing[name], exact: true })
      .or(this.page.getByText(AR.pricing[name], { exact: true }))
      .first();
  }
  /**
   * عدد الخطط المدفوعة في الصفحة (زراير "ترقية إلى …") بعد ما كارت الخطة الحالية يظهر.
   * قرار المنتج 02-11: الفترة الحالية فيه خطة واحدة بس (المجانية) ومفيش ترقية، فالعدد بيبقى 0.
   */
  async paidPlanCount(): Promise<number> {
    await expect(this.page.getByRole('button', { name: 'الخطة الحالية' }).first()).toBeVisible({
      timeout: 30_000,
    });
    return content(this.page)
      .getByRole('button', { name: /^ترقية إلى / })
      .count();
  }
  /** "عرض مقارنة الميزات" */
  get compareToggle(): Locator {
    return this.page.getByText(AR.pricing.showCompare).first();
  }
}

/** صفحة الخصومات /ar/discounts */
export class DiscountsPage extends BasePage {
  /** بيفتح الخصومات على الفرع الحالي ويستنى العنوان */
  async goto(): Promise<void> {
    await this.open('/ar/discounts?scope=currentBranch');
    await expect(this.page.getByText(AR.discounts.title).first()).toBeVisible();
  }
  /** زرار "إضافة خصم جديد" */
  get addButton(): Locator {
    return this.page.getByRole('button', { name: AR.discounts.add });
  }
  /** بيفتح wizard إضافة خصم جديد ويرجّع الـ dialog بتاعه */
  async openWizard(): Promise<Locator> {
    await this.addButton.click();
    const d = this.page.getByRole('dialog').filter({ hasText: AR.discounts.modalTitle });
    await expect(d).toBeVisible();
    return d;
  }
}
