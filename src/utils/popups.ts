/**
 * نوافذ بتظهر لوحدها فوق الصفحة وبتقفل الضغط على أي حاجة تحتها.
 * أهمها في موقع البروفايدر: نافذة "تفعيل الإشعارات" (طلب الإذن / إلغاء) اللي بتظهر للحسابات الجديدة.
 * autoDismissPopups بتسجّل handler: كل ما النافذة تظهر قبل أي ضغطة أو expect، Playwright بيدوس "إلغاء" ويكمّل.
 */
import { Page } from '@playwright/test';

/** بيسجّل إغلاق النوافذ اللي بتظهر لوحدها على الصفحة دي (مرة واحدة لكل صفحة) */
export async function autoDismissPopups(page: Page): Promise<void> {
  await page.addLocatorHandler(page.getByRole('dialog', { name: 'تفعيل الإشعارات' }), async (dialog) => {
    await dialog.getByRole('button', { name: 'إلغاء' }).click();
  });
}
