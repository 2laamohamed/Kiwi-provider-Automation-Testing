/**
 * نافذة "إضافة إلى المعرض" (معرض صور المتجر) – نفس النافذة بتفتح من:
 * صورة البروفايل، صورة المنتج، لوجو وبانر المتجر، ومعرض الفرع.
 *
 *   الزرار ← النافذة بتفتح على حالة من اتنين:
 *     - المعرض فاضي: "لا توجد صور جديدة للرفع" ← نحط الصورة في الخانة بتاعتها
 *     - فيه صور: "الاختيار من معرض المتجر" ← "إضافة جديد" ← نحط الصورة
 *   ← "رفع 1 رفع الأصل إلى المكتبة" ← الصورة الجديدة بتبقى أول كارت ("المضافة أخيرًا")
 *   ← نختار أول N كارت ← "حفظ"
 */
import { Page, Locator, expect } from '@playwright/test';

/** بيفتح المعرض من الزرار، يرفع الصورة، ويختار أول `select` صور (الجديدة أولهم) */
export async function pickFromGallery(page: Page, trigger: Locator, file: string, select = 1): Promise<void> {
  await trigger.click();
  const dlg = page.getByRole('dialog').filter({ hasText: 'إضافة إلى المعرض' }).last();
  await expect(dlg).toBeVisible();
  const emptyGalleryInput = dlg.getByTestId('gallery-staging-file-input');
  const addNew = dlg.getByTestId('gallery-select-add-new');
  await expect(emptyGalleryInput.or(addNew)).toBeAttached({ timeout: 20_000 });
  if (await addNew.isVisible()) {
    await addNew.click();
    await dlg.getByTestId('gallery-device-file-input').setInputFiles(file);
  } else {
    await emptyGalleryInput.setInputFiles(file);
  }
  const commit = dlg.getByTestId('gallery-upload-commit');
  await expect(commit).toBeEnabled();
  await commit.click();
  const tiles = dlg.getByTestId('gallery-image-tile');
  await expect(tiles.first()).toBeVisible({ timeout: 30_000 });
  for (let i = 0; i < select; i++) {
    await tiles.nth(i).click();
    await expect(tiles.nth(i)).toHaveAttribute('aria-pressed', 'true');
  }
  await dlg.getByTestId('gallery-select-confirm').click();
  await expect(dlg).toBeHidden();
}

/** بيفتح المعرض من الزرار ويختار أول `select` صور موجودة (من غير رفع) ← "حفظ" */
export async function selectFromGallery(page: Page, trigger: Locator, select: number): Promise<void> {
  await trigger.click();
  const dlg = page.getByRole('dialog').filter({ hasText: 'إضافة إلى المعرض' }).last();
  await expect(dlg).toBeVisible();
  const tiles = dlg.getByTestId('gallery-image-tile');
  await expect(tiles.nth(select - 1)).toBeVisible({ timeout: 30_000 });
  for (let i = 0; i < select; i++) {
    await tiles.nth(i).click();
    await expect(tiles.nth(i)).toHaveAttribute('aria-pressed', 'true');
  }
  await dlg.getByTestId('gallery-select-confirm').click();
  await expect(dlg).toBeHidden();
}
