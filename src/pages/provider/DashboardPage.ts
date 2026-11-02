/**
 * Page object الداشبورد في موقع البروفايدر /ar/dashboard.
 * فيه أقسام الرئيسية (المواعيد القادمة، التقارير الأسبوعية، آخر الطلبات، آخر التقييمات، أعياد الميلاد)،
 * بانر إكمال الإعداد، اختيار الفرع، المنيو، وتسجيل الخروج.
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { AR } from '../../utils/texts';

/** الداشبورد /ar/dashboard بتاباته (home / appointments / orders / menu) */
export class DashboardPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /** بيفتح الداشبورد على تاب معيّن (الافتراضي الرئيسية) */
  async goto(tab: 'home' | 'appointments' | 'orders' | 'menu' = 'home'): Promise<void> {
    await this.open(`/ar/dashboard?tab=${tab}`);
  }

  /** قسم "المواعيد القادمة" */
  get upcomingAppointments(): Locator {
    return this.page.getByText('المواعيد القادمة').first();
  }
  /** قسم "التقارير الأسبوعية" */
  get weeklyReports(): Locator {
    return this.page.getByText('التقارير الأسبوعية').first();
  }
  /** قسم "آخر الطلبات المستلمة" */
  get latestOrders(): Locator {
    return this.page.getByText('آخر الطلبات المستلمة').first();
  }
  /** قسم "آخر التقييمات" */
  get latestReviews(): Locator {
    return this.page.getByText('آخر التقييمات').first();
  }
  /** قسم "أعياد الميلاد القادمة" */
  get birthdays(): Locator {
    return this.page.getByText('أعياد الميلاد القادمة').first();
  }
  /** بانر "أكمل إعداد نشاطك" */
  get completionBanner(): Locator {
    return this.page.getByText(AR.completion.title).first();
  }

  /** زرار اختيار الفرع في الهيدر */
  get branchSwitcher(): Locator {
    return this.page.getByRole('combobox').first();
  }

  /** بيفتح المنيو الجانبي */
  async openMenu(): Promise<void> {
    await this.menuButton.click();
  }

  /** لينك جوه المنيو بالاسم */
  menuLink(name: string | RegExp): Locator {
    return this.page.getByRole('link', { name }).first();
  }

  /** تسجيل خروج من تاب المنيو، وبيتأكد إنه رجع لصفحة sign-in */
  async logout(): Promise<void> {
    await this.goto('menu');
    await this.page.getByRole('button', { name: AR.auth.logout, exact: true }).click();
    // لو ظهر تأكيد نوافق عليه (حاليًا الخروج بيحصل على طول من غير تأكيد)
    const confirm = this.page.getByRole('dialog').getByRole('button', { name: /تسجيل الخروج|تأكيد|نعم/ });
    const asked = await confirm
      .first()
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    if (asked && /sign-in/.test(this.page.url()) === false) {
      await confirm.first().click();
    }
    await expect(this.page).toHaveURL(/sign-in/, { timeout: 30_000 });
  }

  /** بيتأكد إن أقسام الرئيسية الأساسية ظاهرة (المواعيد، التقارير، الطلبات، التقييمات) */
  async expectHomeSections(): Promise<void> {
    await expect(this.upcomingAppointments).toBeVisible();
    await expect(this.weeklyReports).toBeVisible();
    await expect(this.latestOrders).toBeVisible();
    await expect(this.latestReviews).toBeVisible();
  }
}
