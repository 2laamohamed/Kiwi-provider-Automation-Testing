/**
 * staging ساعات بيقطع: ERR_CONNECTION_TIMED_OUT أو الصفحة مابتردّش في دقيقة.
 * الدالة دي بتخلّي page.goto يعيد المحاولة لوحده (لحد 3 مرات) جوه نفس التست،
 * فالتست مايفشلش ومايتعادش ومايطلعش "flaky" بسبب النت.
 * - بيستنى domcontentloaded (مش load) لأن load ساعات بيعلّق على صور/خطوط، وبعدها بيدّي load فرصة 15 ثانية.
 * - أي خطأ تاني غير النت (زي 404 أو redirect) بيرجع زي ما هو.
 */
import { Page } from '@playwright/test';

const NETWORK_ERROR =
  /ERR_CONNECTION|ERR_TIMED_OUT|ERR_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_ABORTED|Timeout \d+ms exceeded/;

export function withStableGoto(page: Page): Page {
  const original = page.goto.bind(page);
  page.goto = async (url, options) => {
    const opts = { waitUntil: 'domcontentloaded' as const, timeout: 40_000, ...options };
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await original(url, opts);
        await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => undefined);
        return res;
      } catch (e) {
        if (attempt >= 3 || !NETWORK_ERROR.test(String(e))) {
          throw e;
        }
        await page.waitForTimeout(3_000);
      }
    }
  };
  return page;
}
