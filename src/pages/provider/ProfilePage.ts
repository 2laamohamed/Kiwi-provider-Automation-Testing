/**
 * Page object إعدادات الحساب في موقع البروفايدر /ar/profile.
 * فيه خانات الاسم والإيميل، حفظ التغييرات ورسالة النجاح، تعديل رقم التليفون،
 * إعداد تطبيق المصادقة (2FA)، رفع صورة البروفايل من نافذة المعرض، وقراءة صورة البروفايل والهيدر.
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { AR } from '../../utils/texts';
import { pickFromGallery } from '../../utils/gallery';

/** صفحة إعدادات الحساب /ar/profile */
export class ProfilePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /** بيفتح /ar/profile ويستنى خانة الاسم */
  async goto(): Promise<void> {
    await this.open('/ar/profile');
    await expect(this.firstName).toBeVisible();
  }

  /** خانة الاسم الأول */
  get firstName(): Locator {
    return this.page.getByPlaceholder(AR.auth.namePlaceholder).nth(0);
  }
  /** خانة اسم العيلة */
  get lastName(): Locator {
    return this.page.getByPlaceholder(AR.auth.namePlaceholder).nth(1);
  }
  /** خانة الإيميل */
  get email(): Locator {
    return this.page.getByPlaceholder(AR.auth.emailPlaceholder);
  }
  /** زرار "حفظ التغييرات" */
  get save(): Locator {
    return this.page.getByRole('button', { name: AR.profile.save });
  }
  /** زرار "تعديل" رقم التليفون */
  get editPhone(): Locator {
    return this.page.getByRole('button', { name: AR.profile.editPhone, exact: true });
  }
  /** زرار "تعيين تطبيق المصادقة" (2FA) */
  get setupAuthenticator(): Locator {
    return this.page.getByRole('button', { name: AR.profile.setupAuthenticator });
  }
  /** نافذة "تم تحديث ملفك الشخصي بنجاح" */
  get successDialog(): Locator {
    return this.page.getByRole('dialog').filter({ hasText: AR.profile.successTitle });
  }

  /** زرار "رفع" تحت صورة البروفايل (بيفتح نافذة "إضافة إلى المعرض") */
  get uploadPhotoButton(): Locator {
    return this.page.getByRole('button', { name: 'رفع', exact: true }).first();
  }
  /** نافذة "إضافة إلى المعرض" (معرض صور المتجر) */
  get galleryDialog(): Locator {
    return this.page.getByRole('dialog').filter({ hasText: 'إضافة إلى المعرض' });
  }

  /**
   * بيرفع صورة بروفايل جديدة ويختارها:
   *   "رفع" ← نافذة المعرض
   *     - لو المعرض فاضي (حساب جديد): بتفتح على "لا توجد صور جديدة للرفع" ← نحط الصورة في الخانة بتاعتها
   *     - لو فيه صور قبل كده: بتفتح على "الاختيار من معرض المتجر" ← "إضافة جديد" ← نحط الصورة
   *   ← "رفع 1 رفع الأصل إلى المكتبة" ← الصورة بتظهر أول واحدة في المعرض ← نختارها ← "حفظ"
   * الصورة لسه مش متحفظة في الحساب – لازم "حفظ التغييرات" بعدها.
   */
  async uploadPhoto(file: string): Promise<void> {
    await pickFromGallery(this.page, this.uploadPhotoButton, file);
  }

  /** بيقفل نافذة النجاح بزرار "رجوع" ويتأكد إنها اختفت */
  async closeSuccess(): Promise<void> {
    await this.successDialog.getByRole('button', { name: AR.profile.back }).click();
    await expect(this.successDialog).toBeHidden();
  }

  /** صورة البروفايل (أكبر صورة في كارت الملف الشخصي) */
  async avatarSrc(): Promise<string> {
    return this.page.evaluate(() => {
      const imgs = Array.from(document.images).filter((i) => i.width >= 60);
      const img = imgs[0];
      if (!img) {
        return '';
      }
      const fromAlt = img.alt && img.alt.includes('/uploads/') ? img.alt : '';
      return fromAlt || decodeURIComponent(img.currentSrc || img.src);
    });
  }

  /** صورة الهيدر الصغيرة */
  async headerAvatarSrc(): Promise<string> {
    return this.page.evaluate(() => {
      const img = Array.from(document.images).find((i) => i.width > 30 && i.width < 60);
      return img ? decodeURIComponent(img.currentSrc || img.src) : '';
    });
  }
}
