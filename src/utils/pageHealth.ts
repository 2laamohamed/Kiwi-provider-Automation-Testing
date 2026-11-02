/**
 * فحص "صحة" الصفحة – بيستخدم في كل التستات (أدمن وبروفايدر).
 * فيه: PageHealth اللي بيلقط أي crash أو JS error أو API رجّع 5xx،
 * و waitForPageReady عشان نستنى الصفحة تحمّل،
 * وفحوصات النص: مفيش translation keys خام ومفيش null/undefined/NaN ظاهرين للمستخدم.
 */
import { Page, expect } from '@playwright/test';

/**
 * بيجمع أي JS exception أو console error بيحصل في الصفحة.
 * أي crash زي "Application error: a client-side exception" هيبان هنا.
 */
export class PageHealth {
  /** أخطاء JS اللي محدش مسكها (uncaught) */
  readonly pageErrors: string[] = [];
  /** رسايل console.error */
  readonly consoleErrors: string[] = [];
  /** طلبات /api/ اللي رجعت 5xx */
  readonly failedApi: string[] = [];

  /** بيبدأ يسمع على أحداث الصفحة أول ما يتعمل */
  constructor(private readonly page: Page) {
    page.on('pageerror', (err) => this.pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
    });
    page.on('response', (res) => {
      const url = res.url();
      if (/\/api\//.test(url) && res.status() >= 500) {
        this.failedApi.push(`${res.status()} ${res.request().method()} ${url}`);
      }
    });
  }

  /** يفشّل التست لو الصفحة وقعت أو API رجّع 5xx – حطيها في آخر أي تست بيفتح صفحة */
  async expectHealthy(): Promise<void> {
    await expect(
      this.page.getByText(/Application error: a client-side exception/i),
      'Page crashed with "Application error"',
    ).toHaveCount(0);
    expect(this.pageErrors, `Uncaught JS errors:\n${this.pageErrors.join('\n')}`).toEqual([]);
    expect(this.failedApi, `API 5xx responses:\n${this.failedApi.join('\n')}`).toEqual([]);
  }
}

/** بيستنى لحد ما الـ skeleton loaders تختفي والصفحة تهدى */
export async function waitForPageReady(page: Page, timeout = 30_000): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  // بعض الصفحات فيها polling فممكن networkidle مايحصلش – مش مشكلة، بنكمّل عادي
  await page.waitForLoadState('networkidle', { timeout }).catch(() => undefined);
}

/** يتأكد إن مفيش translation keys خام ظاهرة (زي dashboard.x.y أو common.notFound) */
export async function expectNoRawI18nKeys(page: Page): Promise<void> {
  const text = await page.locator('body').innerText();
  const raw = text.match(/\b[A-Za-z]+(?:\.[A-Za-z]+){2,}\b/g) ?? [];
  const filtered = raw.filter(
    (k) => !/(\.com|\.vip|\.test|\.invalid|\.net|\.org|\.png|\.jpg|www\.|mykiwi)/i.test(k),
  );
  expect(filtered, `Raw i18n keys visible on page: ${filtered.join(', ')}`).toEqual([]);
}

/** يتأكد إن كلمة null/undefined/NaN مش ظاهرة كنص للمستخدم */
export async function expectNoNullText(page: Page): Promise<void> {
  const text = await page.locator('body').innerText();
  const hits = text.match(/\b(null|undefined|NaN)\b/g) ?? [];
  expect(hits, `Found "${hits.join(', ')}" rendered as text`).toEqual([]);
}
