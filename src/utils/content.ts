/**
 * المحتوى الأساسي للصفحة (من غير الهيدر والمنيو والبانرات اللي فوق).
 * - لوحة الأدمن فيها عنصر <main>.
 * - موقع البروفايدر مفيهوش <main> خالص، فبناخد الـ container اللي تحت المنيو وفيه محتوى الصفحة.
 * استخدميها بدل page.locator('main') في أي تست.
 */
import { Page, Locator } from '@playwright/test';

/** الـ selector اللي بيجيب المحتوى في الموقعين */
export const CONTENT_SELECTOR = 'main, div[class*="md:bg-background"].container';

/** بيرجّع محتوى الصفحة (أول عنصر مطابق) */
export function content(page: Page): Locator {
  return page.locator(CONTENT_SELECTOR).first();
}
