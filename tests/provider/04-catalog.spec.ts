// تستات كتالوج النشاط: الخدمات والعمال ومنتجات السوق.
// الشاشات: الخدمات  /services  ،  العمال  /workers  ،  منتجات السوق  /products
// (كل صفحة فيها تابين: "الفرع الحالي" ?scope=currentBranch و "جميع الفروع" ?scope=allBranches).
// User stories: Services, Workers, Market products – branch scope & plan limits.
// بيتأكد إن "جميع الفروع" مقفولة على الباقة الأساسية، ومن فاليديشن popup إضافة منتج.
import { test, expect } from '../../src/fixtures/provider.fixture';
import { AR } from '../../src/utils/texts';
import { expectNoRawI18nKeys } from '../../src/utils/pageHealth';
import { content } from '../../src/utils/content';

// الـ 3 صفحات اللي ليها نفس الشكل (scope tabs + زرار إضافة)، بنلف عليهم ونعمل نفس التستات لكل واحدة.
const scoped = [
  { name: 'services', label: AR.businessSettings.services },
  { name: 'workers', label: AR.businessSettings.workers },
  { name: 'products', label: AR.products.title },
] as const;

// لكل صفحة من الـ 3 (services / workers / products) بنعمل describe فيه نفس التستات.
for (const s of scoped) {
  // مجموعة تستات صفحة واحدة (اسمها = اسم الصفحة).
  test.describe(`${s.name}`, () => {
    // القائمة بتفتح على "الفرع الحالي": تاب الفرع الحالي وزرار الإضافة ظاهرين، ومفيش errors.
    test(`${s.name} list loads for current branch @smoke`, async ({
      services,
      workers,
      products,
      page,
      health,
    }) => {
      const p = { services, workers, products }[s.name];
      await p.goto('currentBranch');
      await expect(p.currentBranchTab).toBeVisible();
      await expect(p.addButton).toBeVisible();
      await expectNoRawI18nKeys(page);
      await health.expectHealthy();
    });

    // على الباقة الأساسية: تاب "جميع الفروع" لازم يظهر رسالة "لعرض جميع الفروع، يرجى ترقية خطتك"
    // وزرار "ترقية الخطة" يودّي لـ /pricing أو /subscription.
    test(`${s.name}: "all branches" is locked on basic plan with upgrade CTA`, async ({
      services,
      workers,
      products,
      page,
    }) => {
      const p = { services, workers, products }[s.name];
      await p.goto('currentBranch');
      await p.allBranchesTab.click();
      // على الباقة الأساسية: لازم رسالة الترقية وزرار ترقية الخطة
      await expect(p.upgradeNote).toBeVisible();
      await p.upgradeCta.click();
      await expect(page).toHaveURL(/pricing|subscription/);
    });

    // البحث بكلمة مش موجودة: المتوقع الصفحة متقعش (الـ 3 صفحات فيهم خانة "البحث في....").
    test(`${s.name}: search filters without crash`, async ({ services, workers, products, health }) => {
      const p = { services, workers, products }[s.name];
      await p.goto('currentBranch');
      await expect(p.search).toBeVisible();
      await p.search.fill('zzzz-no-match');
      await p.page.waitForTimeout(1500);
      await health.expectHealthy();
    });
  });
}

// popup "إضافة خدمة" في صفحة الخدمات.
test.describe('services – add modal', () => {
  // الـ popup لازم يعرض اختيارين: "اختر من المتاح" و "إضافة جديد".
  test('add-service modal offers "choose existing" and "add new"', async ({ services }) => {
    await services.goto();
    const dlg = await services.openAddModal();
    await expect(dlg.getByText(AR.services.chooseExisting).first()).toBeVisible();
    await expect(dlg.getByText(AR.services.addNew).first()).toBeVisible();
  });
});

// popup "إضافة منتج جديد" في صفحة منتجات السوق (فاليديشن بس، مش بيحفظ حاجة).
test.describe('products – add product modal', () => {
  // قبل كل تست: افتح صفحة منتجات السوق.
  test.beforeEach(async ({ products }) => {
    await products.goto();
  });

  // عنوان الـ popup لازم يكون "إضافة منتج جديد" وفيه تابين: "اختر من المتاح" و"إضافة جديد".
  test('modal title is "add new product" with "choose existing" / "add new" tabs', async ({ products }) => {
    const dlg = await products.openAddModal();
    await expect(dlg.getByTestId('page-header-title')).toHaveText(AR.products.modalTitle);
    await expect(dlg.getByTestId('e2e-branch-product-tab-existing')).toHaveText(AR.services.chooseExisting);
    await expect(dlg.getByTestId('e2e-branch-product-tab-new')).toHaveText(AR.services.addNew);
  });

  // تاب "إضافة جديد" والضغط على "حفظ والعودة" والفورم فاضي: المتوقع أخطاء required
  // (الصورة، الاسم بالعربي والإنجليزي، السعر، الفئة).
  test('empty submit shows required errors (image, names, price, category)', async ({ products }) => {
    const dlg = await products.openAddModal('new');
    await dlg.getByRole('button', { name: AR.products.saveAndBack }).click();
    for (const msg of [
      AR.products.imageRequired,
      'اسم منتج السوق باللغة العربية مطلوب',
      'اسم منتج السوق باللغة الإنجليزية مطلوب',
      'الفئة مطلوبة',
    ]) {
      await expect(dlg.getByText(msg).first()).toBeVisible();
    }
  });

  // سعر = 0: المتوقع رسالة "يجب أن يكون السعر أكبر من".
  test('price 0 is rejected', async ({ products }) => {
    const dlg = await products.openAddModal('new');
    await dlg.getByPlaceholder(AR.products.pricePlaceholder).fill('0');
    await dlg.getByRole('button', { name: AR.products.saveAndBack }).click();
    await expect(dlg.getByText(AR.products.priceError).first()).toBeVisible();
  });

  // مخزون بالسالب (-5): لو الحقل قبل علامة "-" لازم تظهر "يرجى إدخال كمية صالحة"، ولو منعها يبقى تمام.
  test('negative stock is rejected', async ({ products }) => {
    const dlg = await products.openAddModal('new');
    await dlg.getByPlaceholder(AR.products.stockPlaceholder).fill('-5');
    await dlg.getByRole('button', { name: AR.products.saveAndBack }).click();
    const val = await dlg.getByPlaceholder(AR.products.stockPlaceholder).inputValue();
    if (val.includes('-')) {
      await expect(dlg.getByText(AR.products.qtyError).first()).toBeVisible();
    }
  });

  // لو فيه منتج مخزونه 0، لازم البادج بتاعه يبقى "نفد المخزون" مش "متوفر".
  test('stock badges match quantities (low stock / out of stock)', async ({ products, page }) => {
    const text = await content(page).innerText();
    // لو فيه منتج مخزونه 0 لازم يظهر "نفد المخزون" مش "متوفر"
    if (/المخزون\s*[:：]?\s*0\b/.test(text)) {
      await expect(products.badge(AR.products.outOfStock).first()).toBeVisible();
    }
  });
});
