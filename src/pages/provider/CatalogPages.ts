/**
 * Page objects صفحات الكتالوج في موقع البروفايدر:
 * إعدادات النشاط التجاري /ar/dashboard?tab=menu، الخدمات /ar/services،
 * العمال /ar/workers، ومنتجات السوق /ar/products.
 * وفيه ScopedListPage: الأساس للصفحات اللي فيها تابات "الفرع الحالي / جميع الفروع".
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { AR } from '../../utils/texts';
import { content } from '../../utils/content';

/** صفحات فيها تابات "الفرع الحالي / جميع الفروع" (الخدمات، العمال، المنتجات، المحفظة، العملاء…) */
export abstract class ScopedListPage extends BasePage {
  /** مسار الصفحة – كل صفحة بتحدده */
  abstract readonly path: string;

  /** بيفتح الصفحة على الفرع الحالي (الافتراضي) أو جميع الفروع */
  async goto(scope: 'currentBranch' | 'allBranches' = 'currentBranch'): Promise<void> {
    await this.open(`${this.path}?scope=${scope}`);
  }

  /** تاب "الفرع الحالي" */
  get currentBranchTab(): Locator {
    return this.page.getByRole('button', { name: AR.scope.current, exact: true });
  }
  /** تاب "جميع الفروع" */
  get allBranchesTab(): Locator {
    return this.page.getByRole('button', { name: AR.scope.all, exact: true });
  }
  /** ملاحظة "لعرض جميع الفروع، يرجى ترقية خطتك" */
  get upgradeNote(): Locator {
    return this.page.getByText(AR.scope.upgradeNote).first();
  }
  /** زرار/لينك "ترقية الخطة" */
  get upgradeCta(): Locator {
    return this.page
      .getByRole('button', { name: AR.scope.upgradeCta })
      .or(this.page.getByRole('link', { name: AR.scope.upgradeCta }))
      .first();
  }
  /** خانة البحث في الصفحة */
  get search(): Locator {
    return this.page.getByPlaceholder(/البحث في|ابحث في/).first();
  }

  /** العدد اللي جنب العنوان: "الخدمات (3)" */
  async headerCount(label: string): Promise<number> {
    const loc = this.page.getByText(new RegExp(`${label}\\s*\\(\\d+\\)`)).first();
    await expect(loc).toBeVisible();
    const m = (await loc.innerText()).match(/\((\d+)\)/);
    return m ? Number(m[1]) : NaN;
  }
}

/** إعدادات النشاط التجاري /ar/dashboard?tab=menu – الخطة الحالية ولينكات الفرع والخدمات والعمال ... */
export class BusinessSettingsPage extends BasePage {
  /** بيفتح الصفحة ويستنى كارت "الخطة الحالية" */
  async goto(): Promise<void> {
    await this.open('/ar/dashboard?tab=menu');
    await expect(this.page.getByText(AR.businessSettings.currentPlan).first()).toBeVisible();
  }
  /** لينك من لينكات الصفحة بالاسم (services، workers، workingHours ...) */
  link(name: keyof typeof AR.businessSettings): Locator {
    return this.page.getByRole('link', { name: AR.businessSettings[name], exact: true }).first();
  }
  /** لينك اختيار/تغيير الخطة (بيروح لـ /pricing) */
  get choosePlanLink(): Locator {
    return this.page.locator('a[href*="/pricing"]').first();
  }
}

/** صفحة الخدمات /ar/services */
export class ServicesPage extends ScopedListPage {
  readonly path = '/ar/services';
  /** زرار "إضافة خدمة للفرع" */
  get addButton(): Locator {
    return this.page.getByRole('button', { name: AR.services.add });
  }
  /** بيفتح نافذة "إضافة خدمة" ويرجّعها */
  async openAddModal(): Promise<Locator> {
    await this.addButton.click();
    const d = this.page.getByRole('dialog').filter({ hasText: AR.services.modalTitle });
    await expect(d).toBeVisible();
    return d;
  }
}

/** صفحة العمال /ar/workers */
export class WorkersPage extends ScopedListPage {
  readonly path = '/ar/workers';
  /** زرار "إضافة عامل للفرع" */
  get addButton(): Locator {
    return this.page.getByRole('button', { name: AR.workers.add });
  }
}

/** صفحة منتجات السوق /ar/products */
export class ProductsPage extends ScopedListPage {
  readonly path = '/ar/products';

  /** زرار "إضافة منتج للفرع" */
  get addButton(): Locator {
    return this.page.getByTestId('e2e-products-add-branch');
  }
  /**
   * بيفتح نافذة "إضافة منتج جديد" ويرجّعها.
   * النافذة فيها تابين: "اختر من المتاح" (الافتراضي) و"إضافة جديد" – tab = 'new' بيفتح على إضافة منتج جديد.
   */
  async openAddModal(tab: 'existing' | 'new' = 'existing'): Promise<Locator> {
    await this.addButton.click();
    const d = this.page.getByRole('dialog').filter({ has: this.page.getByTestId('e2e-branch-product-form') });
    await expect(d).toBeVisible();
    if (tab === 'new') {
      await d.getByTestId('e2e-branch-product-tab-new').click();
      await expect(d.getByTestId('e2e-branch-product-name-ar')).toBeVisible();
    }
    return d;
  }
  /** كروت المنتجات (data-testid) */
  get rows(): Locator {
    return this.page.getByTestId('e2e-products-row');
  }
  /** كروت المنتجات */
  get cards(): Locator {
    return content(this.page)
      .getByText(/L\.E|ر\.س|SAR|EGP|AED/)
      .locator('xpath=ancestor::*[self::div or self::a][.//img][1]');
  }
  /** شارة حالة المخزون بالنص (متوفر / أوشك على النفاد / نفد المخزون) */
  badge(text: string): Locator {
    return this.page.getByText(text, { exact: true });
  }
}
