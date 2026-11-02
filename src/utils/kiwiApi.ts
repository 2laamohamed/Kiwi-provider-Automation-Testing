/**
 * مساعد صغير بيكلّم الـ API بتاع كيوي مباشرة (من غير ما نفتح صفحات).
 * بنستخدمه في التستات عشان نقرأ القيم الحقيقية ونقارنها باللي ظاهر في الشاشة،
 * مثلاً: ساعات العمل اللي اتحفظت، رسوم المتجر، الضريبة، والحد الأدنى للسحب.
 *
 * التوكن بيتاخد من الكوكي "token" اللي الموقع نفسه بيحطها بعد تسجيل الدخول،
 * فلازم الصفحة تكون داخلة بحساب (بروفايدر أو أدمن) قبل ما نستخدمه.
 *
 * عنوان الـ API: https://staging.mykiwi.vip/api/v1 (ممكن يتغيّر من KIWI_API_URL في .env)
 */
import { Page, APIRequestContext, request as pwRequest } from '@playwright/test';

/** عنوان الـ API الأساسي */
export const API_URL = process.env.KIWI_API_URL || 'https://staging.mykiwi.vip/api/v1';

/** شكل الرد اللي الـ API بيرجّعه دايمًا: ok و code و message و data */
export type ApiResponse<T = unknown> = { ok: boolean; code: number; message: string; data: T };

/** بيقرأ التوكن من كوكيز الصفحة (بعد اللوجين) */
export async function tokenFrom(page: Page): Promise<string> {
  const cookie = (await page.context().cookies()).find((c) => c.name === 'token');
  if (!cookie) {
    throw new Error('مفيش توكن في الكوكيز – الصفحة لازم تكون عاملة login الأول');
  }
  return decodeURIComponent(cookie.value);
}

/**
 * بيرجّع client جاهز للـ API بتوكن الصفحة.
 * scope = 'provider' للبروفايدر (/provider/...).
 * مثال: const api = await kiwiApi(page, 'provider'); const me = await api.get('/profile/me');
 */
export async function kiwiApi(page: Page, scope: 'provider' | 'admin') {
  const token = await tokenFrom(page);
  const ctx: APIRequestContext = await pwRequest.newContext({
    baseURL: `${API_URL}/${scope}/`,
    extraHTTPHeaders: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Accept-Language': 'ar',
    },
  });

  // بيبعت GET ويرجّع data، ولو الرد مش 2xx بيرمي error فيه الرسالة
  async function get<T = any>(path: string): Promise<T> {
    const res = await ctx.get(path.replace(/^\//, ''));
    const body = (await res.json().catch(() => ({}))) as ApiResponse<T>;
    if (!res.ok()) {
      throw new Error(`GET ${scope}${path} → ${res.status()} ${body.message ?? ''}`);
    }
    return body.data;
  }

  // بيبعت GET ويرجّع الحالة والرد كامل من غير ما يرمي error (للتستات اللي بتتأكد من رفض الطلب)
  async function raw(path: string): Promise<{ status: number; body: ApiResponse }> {
    const res = await ctx.get(path.replace(/^\//, ''));
    return { status: res.status(), body: (await res.json().catch(() => ({}))) as ApiResponse };
  }

  // بيقفل الـ client بعد ما التست يخلص
  async function dispose(): Promise<void> {
    await ctx.dispose();
  }

  return { get, raw, dispose };
}
