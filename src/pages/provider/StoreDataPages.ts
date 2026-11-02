/**
 * Page objects الشاشات اللي onboarding بيضيف منها داتا للحساب الجديد (عشان تستات البروفايدر تلاقي داتا معروفة):
 *   منتجات السوق /products   ← "إضافة منتج للفرع" ← تاب "إضافة جديد"
 *   الخصومات /discounts       ← wizard "إضافة خصم جديد" (الفروع ← التفاصيل ← الدول ← المنتجات ← الخدمات)
 *   تفاصيل المتجر /shop       ← "تعديل المتجر" (لوجو + بانر)
 *   معرض الفرع /branches-gallery ← "إضافة صورة جديدة"
 * كل الصور بتترفع من نافذة المعرض (src/utils/gallery.ts).
 */
import { Page, Locator, expect } from '@playwright/test';
import { pickFromGallery, selectFromGallery } from '../../utils/gallery';
import { AR_MONTHS } from '../../utils/texts';

/** بيانات منتج جديد */
export type ProductData = {
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  price: string;
  stock: string;
  image: string;
};

/** صفحة منتجات السوق – إضافة منتج جديد بصورة */
export class ProductCreator {
  constructor(private page: Page) {}

  get rows(): Locator {
    return this.page.getByTestId('e2e-products-row');
  }
  get count(): Locator {
    return this.page.getByTestId('e2e-products-count');
  }

  /** بيضيف منتج جديد ويرجّع اسم الفئة اللي اختارها (أول فئة في القايمة) */
  async add(p: ProductData): Promise<string> {
    await this.page.goto('/ar/products?scope=currentBranch');
    await this.page.getByTestId('e2e-products-add-branch').click();
    const dlg = this.page
      .getByRole('dialog')
      .filter({ has: this.page.getByTestId('e2e-branch-product-form') });
    await expect(dlg).toBeVisible();
    await dlg.getByTestId('e2e-branch-product-tab-new').click();
    await expect(dlg.getByTestId('e2e-branch-product-name-ar')).toBeVisible();

    await pickFromGallery(
      this.page,
      dlg.getByTestId('e2e-branch-product-main-image').getByRole('button').first(),
      p.image,
    );
    await dlg.getByTestId('e2e-branch-product-name-ar').fill(p.nameAr);
    await dlg.getByTestId('e2e-branch-product-name-en').fill(p.nameEn);
    await dlg.locator('textarea[name="description_ar"]').fill(p.descAr);
    await dlg.locator('textarea[name="description_en"]').fill(p.descEn);
    await dlg.getByTestId('e2e-branch-product-catalog-price').fill(p.price);
    await dlg.getByTestId('e2e-branch-product-stock').fill(p.stock);

    // مجموعة منتجات السوق: أول فئة متاحة لنوع النشاط (صالون تجميل)
    const category = dlg.getByTestId('e2e-branch-product-category');
    await category.getByRole('combobox').or(category.getByRole('button')).first().click();
    const option = this.page.getByRole('option').first();
    await expect(option).toBeVisible();
    const categoryName = (await option.innerText()).trim();
    await option.click();
    await expect(category).toContainText(categoryName);

    await dlg.getByTestId('e2e-branch-product-submit').click();
    await expect(dlg).toBeHidden({ timeout: 30_000 });
    await expect(this.rows.filter({ hasText: p.nameAr })).toBeVisible({ timeout: 30_000 });
    return categoryName;
  }
}

/** التاريخ بعد n يوم بتوقيت القاهرة: { day, month (1-12), year } */
function cairoDatePlus(days: number): { day: number; month: number; year: number } {
  const now = new Date(Date.now() + days * 86_400_000);
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' })
    .format(now)
    .split('-')
    .map(Number);
  return { day: d, month: m, year: y };
}

/** صفحة الخصومات – wizard "إضافة خصم جديد" */
export class DiscountCreator {
  constructor(private page: Page) {}

  get dialog(): Locator {
    return this.page.getByTestId('e2e-discount-dialog-create');
  }
  get next(): Locator {
    return this.dialog.getByTestId('e2e-discount-dialog-create-next');
  }

  /** بيفتح الـ wizard من صفحة الخصومات */
  async open(): Promise<void> {
    await this.page.goto('/ar/discounts?scope=currentBranch');
    await this.page.getByTestId('e2e-discounts-add-new').click();
    await expect(this.dialog).toBeVisible();
  }

  /**
   * بيختار يوم من نتيجة التاريخ اللي فتحها الزرار (اليوم الحالي + days).
   * النتيجة بتفتح كنافذة لوحدها وبتفضل مفتوحة بعد اختيار اليوم (ونافذة الخصم ورا بتبقى aria-hidden)،
   * عشان كده بعد الاختيار بنقفلها بـ Escape ونستنى لحد ما تختفي.
   */
  async pickDate(trigger: Locator, days: number): Promise<void> {
    await trigger.click();
    const calendar = this.page.getByRole('dialog').filter({ has: this.page.getByRole('grid') });
    await expect(calendar).toBeVisible();
    const today = cairoDatePlus(0);
    const target = cairoDatePlus(days);
    if (target.month !== today.month) {
      await calendar.getByRole('button', { name: /Next Month/i }).click();
    }
    // اسم زرار اليوم: "الاثنين، 9 نوفمبر 2026" (والنهارده قبله "Today, ")
    const label = new RegExp(`، ${target.day} ${AR_MONTHS[target.month - 1]} ${target.year}`);
    await calendar.getByRole('gridcell').getByRole('button', { name: label }).click();
    await this.page.waitForTimeout(500);
    if (await calendar.isVisible()) {
      await this.page.keyboard.press('Escape');
    }
    await expect(calendar).toBeHidden();
    await expect(this.dialog).toBeVisible();
  }

  /** خطوة "التفاصيل": الرمز + النسبة + من/إلى (أيام من النهارده) */
  async fillDetails(code: string, percent: string, fromDays: number, toDays: number): Promise<void> {
    await this.dialog.locator('input[name="code"]').fill(code);
    await this.dialog.locator('input[name="value"]').fill(percent);
    // زراير التاريخ (اسمها "من*" و "إلى*" وجواها "اختر تاريخ البداية / النهاية")
    await this.pickDate(this.dialog.locator('button').filter({ hasText: 'اختر تاريخ البداية' }), fromDays);
    await this.pickDate(this.dialog.locator('button').filter({ hasText: 'اختر تاريخ النهاية' }), toDays);
  }

  /** بيختار الفرع بالاسم في خطوة "الفروع" */
  async selectBranch(branchName: string): Promise<void> {
    await this.dialog.getByText(branchName, { exact: true }).first().click();
    await expect(this.dialog).toContainText(/العناصر المحددة\s*1/);
  }

  /**
   * خصم كامل: الفرع ← التفاصيل ← الدول (اختياري) ← كل المنتجات ← كل الخدمات ← "حفظ التغييرات"
   * المتوقع: "تمت إضافة الخصم بنجاح" والكارت بتاعه يظهر في القايمة.
   */
  async create(branchName: string, code: string, percent: string): Promise<void> {
    await this.open();
    await this.selectBranch(branchName);
    await this.next.click();
    await this.fillDetails(code, percent, 0, 7);
    await this.next.click();
    await expect(this.dialog.getByTestId(/e2e-discount-country-row-/).first()).toBeVisible();
    await this.next.click();
    await this.dialog.getByText('تحديد كل منتجات السوق', { exact: true }).click();
    await this.next.click();
    await this.dialog.getByText('تحديد كل الخدمات', { exact: true }).click();
    await this.dialog.getByRole('button', { name: 'حفظ التغييرات' }).click();
    const done = this.page.getByRole('dialog').filter({ hasText: 'تمت إضافة الخصم بنجاح' });
    await expect(done).toBeVisible({ timeout: 30_000 });
    await done.getByRole('button', { name: 'رجوع' }).click();
    await expect(
      this.page.locator('[data-testid^="e2e-discount-card-"]').filter({ hasText: code }),
    ).toBeVisible();
  }
}

/** صفحة تفاصيل المتجر /shop – تعديل المتجر (لوجو + بانر) */
export class ShopEditor {
  constructor(private page: Page) {}

  async uploadLogoAndCover(logo: string, cover: string): Promise<void> {
    await this.page.goto('/ar/shop');
    await this.page.getByTestId('e2e-shop-edit-button').click();
    const dlg = this.page.getByRole('dialog').filter({ hasText: 'تعديل المتجر' });
    await expect(dlg).toBeVisible();
    await pickFromGallery(
      this.page,
      dlg.getByTestId('setup-shop-logo-upload').getByRole('button').first(),
      logo,
    );
    await pickFromGallery(
      this.page,
      dlg.getByTestId('setup-shop-cover-upload').getByRole('button').first(),
      cover,
    );
    await dlg.getByTestId('setup-shop-submit-button').click();
    const done = this.page.getByRole('dialog').filter({ hasText: 'تم تحديث المتجر بنجاح' });
    await expect(done).toBeVisible({ timeout: 30_000 });
    await done.getByRole('button', { name: 'رجوع' }).click();
  }
}

/** صفحة معرض الفرع /branches-gallery */
export class BranchGallery {
  constructor(private page: Page) {}

  get count(): Locator {
    return this.page.getByTestId('e2e-branches-gallery-count');
  }

  /**
   * بيختار أول `select` صور من معرض المتجر ويضيفهم للفرع.
   * ملحوظة: الرفع من نافذة معرض الفرع بيقفل النافذة وبيحط الصورة في مكتبة المتجر بس (مش في الفرع)،
   * عشان كده بنختار من الصور اللي اترفعت قبل كده (الصورة الشخصية، المنتج، اللوجو، البانر).
   */
  async add(select: number): Promise<void> {
    await this.page.goto('/ar/branches-gallery');
    await selectFromGallery(this.page, this.page.getByTestId('e2e-branches-gallery-add-images'), select);
  }
}
