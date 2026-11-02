// تستات متقدمة لصفحة منتجات السوق.
// الشاشة: منتجات السوق  /products  (تاب "الفرع الحالي" و"جميع الفروع"، كروت المنتجات، popup تفاصيل المنتج
// والتعديل، وpopup "إضافة منتج للفرع").
// User stories: 5976، 5981، 5986، 6107، 6114، 6118، 6121، 6126، 6130.
// الحساب: حساب onboarding (onboarding بيضيفله منتج بصورة في قسم 8).
// تست إنشاء منتج @destructive بيضيف منتج حقيقي، وبيشتغل بس مع npm run test:destructive.
import * as path from 'path';
import { test, expect } from '../../src/fixtures/provider.fixture';
import { env } from '../../src/config/env';
import { AR } from '../../src/utils/texts';
import { qaName, toLatinDigits } from '../../src/utils/data';
import { content } from '../../src/utils/content';
import { mainProvider } from '../../src/fixtures/qaProvider';

// مجموعة تستات منتجات السوق.
test.describe('Marketplace products', () => {
  // قبل كل تست: افتح صفحة منتجات السوق (الفرع الحالي).
  test.beforeEach(async ({ products }) => {
    await products.goto();
  });

  // US 6107 / 6130: العنوان "منتجات السوق" والزرار "إضافة منتج للفرع"، ومفيش زرار بالاسم القديم "إضافة للفرع".
  test('naming: "منتجات السوق" title and "إضافة منتج للفرع" button (US 6107 / 6130)', async ({
    products,
    page,
  }) => {
    await expect(page.getByText(AR.products.title).first()).toBeVisible();
    await expect(products.addButton).toBeVisible();
    await expect(page.getByRole('button', { name: /^إضافة للفرع$/ })).toHaveCount(0);
  });

  // US 5976: المنتجات بتظهر كروت (صورة + اسم + سعر + مخزون) مش جدول. حساب onboarding فيه منتج واحد على الأقل.
  test('products are displayed as cards with image, name, price and stock (US 5976)', async ({
    products,
    page,
  }) => {
    await expect(products.rows.first()).toBeVisible({ timeout: 30_000 });
    await expect(content(page).locator('table')).toHaveCount(0);
    const card = products.rows.first();
    await expect(card.locator('img').first()).toBeVisible();
    await expect(card).toContainText(/L\.E/);
    expect(toLatinDigits(await card.innerText())).toMatch(/\d/);
  });

  // US 5981: البادج لازم يطابق المخزون: مخزون 0 مينفعش يبقى "متوفر"، و"أوشك على النفاد" لازم مخزونه أكبر من 0.
  test('stock badges are consistent with stock quantity (US 5981)', async ({ page }) => {
    const text = toLatinDigits(await content(page).innerText());
    const blocks = text.split(/(?=المخزون)/);
    for (const b of blocks) {
      const qty = Number(b.match(/المخزون\s*[:：]?\s*(\d+)/)?.[1] ?? NaN);
      if (Number.isNaN(qty)) {
        continue;
      }
      if (qty === 0) {
        expect(b, 'qty 0 must be out of stock').not.toMatch(new RegExp(AR.products.inStock));
      }
      if (/أوشك على النفاد/.test(b)) {
        expect(qty).toBeGreaterThan(0);
      }
    }
  });

  // US 6118: فتح تفاصيل منتج وقفلها بـ Escape لازم يرجّعنا لنفس صفحة القائمة (نفس الـ URL).
  test('closing product details returns to the products list (US 6118)', async ({ products, page }) => {
    await expect(products.rows.first()).toBeVisible({ timeout: 30_000 });
    const url = page.url();
    await products.rows.first().click();
    const dlg = page.getByRole('dialog').last();
    await expect(dlg).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
    expect(page.url().split('?')[0]).toBe(url.split('?')[0]);
  });

  // US 6121 / 5986: تفاصيل المنتج بتتعدّل من نفس النافذة: السعر والمخزون والظهور للعميل،
  // و"نطاق التعديل" واضح ("فرع معين" + اسم الفرع)، وزراير "تحديث منتج السوق" و"حذف منتج السوق". مش بيحفظ.
  test('product details are editable and the edit scope is explicit (US 6121 / 5986)', async ({
    products,
    page,
  }) => {
    await expect(products.rows.first()).toBeVisible({ timeout: 30_000 });
    await products.rows.first().click();
    const dlg = page.getByRole('dialog').last();
    await expect(dlg.getByTestId('e2e-product-detail-branch-price')).toBeVisible();
    await expect(dlg.getByTestId('e2e-product-detail-branch-stock')).toBeVisible();
    await expect(dlg.getByTestId('e2e-product-detail-visibility-switch')).toBeVisible();
    const scope = dlg.getByTestId('e2e-product-detail-modification-scope');
    await expect(scope).toContainText('فرع معين');
    await expect(dlg).toContainText(mainProvider().branchName);
    await expect(dlg.getByTestId('e2e-product-detail-branch-save')).toHaveText(/تحديث منتج السوق/);
    await expect(dlg.getByTestId('e2e-product-detail-delete')).toHaveText(/حذف منتج السوق/);
    await page.keyboard.press('Escape');
  });

  // US 6114: تاب "جميع الفروع" لازم يعرض "إجمالي المخزون". على الباقة المجانية بدل كده بيظهر زرار الترقية.
  test('all branches shows total stock (US 6114) or upgrade note on free plan', async ({
    products,
    page,
  }) => {
    await products.goto('allBranches');
    if (await products.upgradeNote.isVisible().catch(() => false)) {
      await expect(products.upgradeCta).toBeVisible();
      return;
    }
    await expect(page.getByText(/إجمالي المخزون|المخزون الكلي/).first()).toBeVisible();
  });

  // @destructive (بيضيف منتج حقيقي، بيشتغل بس مع npm run test:destructive):
  // بيضيف منتج بصورة واسم وسعر 50 ومخزون 2. المتوقع يظهر في القائمة وعليه بادج "أوشك على النفاد".
  test('create a product and see it in the list, then delete @destructive', async ({ products, page }) => {
    test.skip(!env.runDestructive, 'Creates a product');
    const name = qaName('QA Product');
    const dlg = await products.openAddModal();
    await dlg
      .locator('input[type="file"]')
      .first()
      .setInputFiles(path.join(__dirname, '../assets/avatar.png'));
    await dlg.getByPlaceholder(AR.products.nameArPlaceholder).fill(name);
    await dlg.getByPlaceholder(AR.products.nameEnPlaceholder).fill(name);
    await dlg.getByPlaceholder(AR.products.pricePlaceholder).fill('50');
    await dlg.getByPlaceholder(AR.products.stockPlaceholder).fill('2');
    await dlg.getByRole('button', { name: AR.products.saveAndBack }).click();
    await expect(page.getByText(name).first()).toBeVisible();
    // مخزون 2 → المفروض البادج يبقى "أوشك على النفاد"
    await expect(page.getByText(name).first().locator('xpath=ancestor::*[.//img][1]')).toContainText(
      AR.products.lowStock,
    );
  });
});
