/**
 * الأساس لكل page objects موقع البروفايدر (staging-web).
 * فيه الحاجات المشتركة بين كل الصفحات: فتح مسار، الهيدر، تابات التنقل،
 * زرار المنيو واللغة، العناوين، الـ dialogs، والانتظار لحد ما نص يظهر.
 */
import { Page, Locator, expect } from '@playwright/test';
import { AR } from '../../utils/texts';
import { waitForPageReady } from '../../utils/pageHealth';

/** كل صفحات البروفايدر بتورث منه */
export abstract class BasePage {
  constructor(readonly page: Page) {}

  /** المسارات بتتفتح من غير prefix اللغة: الموقع بيحوّل /ar/... لـ /... حسب اللغة المحفوظة */
  async open(path: string): Promise<void> {
    // page.goto في الـ fixtures متغلّف بـ withStableGoto (بيعيد المحاولة لو النت قطع، وبيستنى domcontentloaded)
    await this.page.goto(path);
    await waitForPageReady(this.page);
  }

  /** هيدر الموقع */
  get header(): Locator {
    return this.page.locator('header, [role="banner"]').first();
  }

  /** تاب في شريط التنقل: الرئيسية / المواعيد / الطلبات / إعدادات النشاط التجاري */
  navTab(name: keyof typeof AR.nav): Locator {
    return this.page
      .getByRole('button', { name: AR.nav[name], exact: true })
      .or(this.page.getByRole('link', { name: AR.nav[name], exact: true }))
      .first();
  }

  /** زرار فتح المنيو (Open menu) */
  get menuButton(): Locator {
    return this.page.getByRole('button', { name: 'Open menu' });
  }

  /** زرار اختيار اللغة */
  get languageButton(): Locator {
    return this.page.getByRole('button', { name: /اختر اللغة|Select language/ });
  }

  /** عنوان الصفحة الرئيسي (h1/h2) */
  heading(text: string | RegExp): Locator {
    return this.page.getByRole('heading', { name: text }).first();
  }

  /** آخر dialog مفتوح في الصفحة */
  dialog(): Locator {
    return this.page.getByRole('dialog').last();
  }

  /** يتأكد إن الـ URL الحالي مطابق للـ regex */
  async expectUrl(re: RegExp): Promise<void> {
    await expect(this.page).toHaveURL(re);
  }

  /** بيستنى لحد ما النص يظهر – مفيد مع الـ skeletons */
  async waitForText(text: string | RegExp, timeout = 30_000): Promise<void> {
    await this.page.getByText(text).first().waitFor({ state: 'visible', timeout });
  }
}
