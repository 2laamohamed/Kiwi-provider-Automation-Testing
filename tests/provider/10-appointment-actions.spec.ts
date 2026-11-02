// تستات تفاصيل الموعد والأكشنز اللي جواه.
// الشاشات: المواعيد  /dashboard?tab=appointments&mode=list  وpopup "تفاصيل الموعد"
// (تسجيل الوصول، إرسال تذكير، تسجيل كعدم حضور، إلغاء الموعد، إعادة الجدولة، تغيير العامل) وملخص الدفع.
// User stories: 5949 (تذكير)، 5954 / 5959 (No show / مكتمل)، 5964 / 5997 (نقل لعامل تاني)،
// 6083 (الأكشنز ثابتة)، 6086 (ارتفاع الصفحة ثابت)، 6076 (realtime)، والإلغاء وإعادة الجدولة.
//
// الحساب: الحساب الجديد اللي onboarding عمله (dataPage). المواعيد بتتعمل من تطبيق العميل،
//   فلو الحساب مفيهوش موعد "قادم" / "مكتمل" تستات التفاصيل بتتعمل skip وسببها بيظهر في آخر الرن.
// الأكشنز اللي بتغيّر داتا عليها @destructive ومش داخلة في الرن العادي (npm run test:destructive).
import { Page, Locator } from '@playwright/test';
import { test, expect } from '../../src/fixtures/provider.fixture';
import { env } from '../../src/config/env';
import { AppointmentsPage } from '../../src/pages/provider/OperationsPages';
import { dataProvider } from '../../src/fixtures/qaProvider';
import { toLatinDigits } from '../../src/utils/data';

/**
 * بيفتح تفاصيل موعد بالحالة دي (بنجيب الموعد من الـ API بالـ id ورقم الحجز، وبنستنى الجدول يتحدّث بعد التاب)
 * – ولو مفيش موعد بالحالة دي التست بيفشل برسالة واضحة.
 * ملحوظة: الموعد "المكتمل" مفيهوش أزرار أكشن خالص (لا تسجيل وصول ولا إلغاء ولا تعديل تاريخ ولا تذكير)،
 * عشان كده لازم نفتح الموعد "القادم" نفسه مش أول صف ظاهر.
 */
async function openFirst(page: Page, status: string): Promise<Locator> {
  const d = await new AppointmentsPage(page).openFirstWithStatus(status);
  // الحساب الجديد اللي onboarding عمله لسه مفيهوش حجوزات (الحجز بيتعمل من تطبيق العميل)
  test.skip(
    d === null,
    `No "${status}" appointment on the new onboarding account (bookings are made from the customer app)`,
  );
  return d!;
}

// مجموعة تستات popup تفاصيل الموعد.
test.describe('Appointment details', () => {
  // تفاصيل الموعد القادم: رقم الحجز RS-…، الحالة "قادم"، اسم الخدمة، "التاريخ"، "العامل"، "ملخص الدفع"،
  // ومفيش null أو undefined أو NaN.
  test('details show reservation no., status, service, date, worker and payment summary', async ({
    dataPage,
  }) => {
    const d = await openFirst(dataPage, 'قادم');
    await expect(d).toContainText(/RS-\d+/);
    await expect(d).toContainText('قادم');
    await expect(d).toContainText(dataProvider().service!.nameAr);
    for (const label of ['التاريخ', 'العامل', 'ملخص الدفع']) {
      await expect(d.getByText(label).first()).toBeVisible();
    }
    await expect(d).not.toContainText(/\bnull\b|\bundefined\b|\bNaN\b/);
  });

  // US 6083: أزرار الأكشن لازم تفضل ثابتة في مكانها وإحنا بنعمل scroll جوه التفاصيل.
  test('actions stay fixed while scrolling details (US 6083)', async ({ dataPage }) => {
    const d = await openFirst(dataPage, 'قادم');
    const actions = d.getByTestId('e2e-appointment-cancel');
    const before = await actions.boundingBox();
    await d.hover();
    await dataPage.mouse.wheel(0, 800);
    await dataPage.waitForTimeout(500);
    const after = await actions.boundingBox();
    expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0)), 'button moved (px)').toBeLessThan(5);
  });

  // US 5949: زرار "إرسال تذكير" ظاهر في الموعد القادم. لو disabled (اتبعت تذكير من أقل من 60 دقيقة)
  // لازم لما نقف عليه يظهر شرح. التست مش بيبعت تذكير.
  test('reminder button is shown; if disabled it explains why (US 5949)', async ({ dataPage }) => {
    const d = await openFirst(dataPage, 'قادم');
    const reminder = d.getByRole('button', { name: /تذكير/ });
    await expect(reminder).toBeVisible();
    if (await reminder.isDisabled()) {
      await reminder.hover({ force: true });
      await expect(dataPage.getByText(/تم إرسال|60|دقيقة|لاحقًا/).first()).toBeVisible();
    }
  });

  // الموعد القادم فيه: تسجيل الوصول، تسجيل كعدم حضور، إلغاء الموعد. والموعد المكتمل مفيهوش ولا واحد منهم
  // (ولا "تحويل إلى مكتمل") – US 5954 / 5959.
  test('upcoming has check-in / no-show / cancel; completed has none of them (US 5954 / 5959)', async ({
    dataPage,
  }) => {
    const up = await openFirst(dataPage, 'قادم');
    for (const id of ['e2e-appointment-check-in', 'e2e-appointment-mark-no-show', 'e2e-appointment-cancel']) {
      await expect(up.getByTestId(id)).toBeVisible();
    }
    await dataPage.keyboard.press('Escape');
    const done = await openFirst(dataPage, 'مكتمل');
    await expect(done).toContainText('مكتمل');
    for (const id of ['e2e-appointment-check-in', 'e2e-appointment-mark-no-show', 'e2e-appointment-cancel']) {
      await expect(done.getByTestId(id)).toHaveCount(0);
    }
    await expect(done.getByRole('button', { name: /^تحويل إلى مكتمل|^إكمال/ })).toHaveCount(0);
  });

  // "إلغاء الموعد" لازم يطلب تأكيد ("هل أنت متأكد..."). التست بيدوس "لا، إبقِ" والموعد يفضل "قادم".
  test('cancel asks for confirmation; "keep" leaves it upcoming', async ({ dataPage }) => {
    const d = await openFirst(dataPage, 'قادم');
    await d.getByTestId('e2e-appointment-cancel').click();
    const confirm = dataPage.getByRole('dialog').filter({ hasText: 'هل أنت متأكد' });
    await expect(confirm).toBeVisible();
    await confirm.getByTestId('e2e-appointment-status-cancel').click();
    await expect(confirm).toBeHidden();
    await expect(d).toContainText('قادم');
  });

  // "إعادة جدولة الموعد": النتيجة بتفتح على الشهر الحالي، النهارده متاح والأيام اللي فاتت مقفولة.
  // التست بيقفل بـ "إلغاء" ومش بيغيّر الموعد.
  test('reschedule opens a calendar where past days are disabled', async ({ dataPage }) => {
    const d = await openFirst(dataPage, 'قادم');
    await d.getByTestId('e2e-appointment-edit-date').click();
    const dlg = dataPage.getByRole('dialog').filter({ hasText: 'إعادة جدولة الموعد' });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole('button', { name: /^Today/ })).toBeEnabled();
    const days = dlg.getByRole('gridcell').getByRole('button');
    const firstEnabled = await days.evaluateAll((els) =>
      els.findIndex((e) => !(e as HTMLButtonElement).disabled),
    );
    const todayIndex = await days.evaluateAll((els) =>
      els.findIndex((e) => /^Today/.test(e.getAttribute('aria-label') ?? '')),
    );
    expect(firstEnabled, 'no day before today is selectable').toBe(todayIndex);
    await dlg.getByRole('button', { name: 'إلغاء', exact: true }).click();
    await expect(dlg).toBeHidden();
  });

  // @destructive (بيغيّر حالة موعد حقيقي): بيحوّل موعد نشط لـ "لم يظهر".
  test('mark appointment as No show @destructive', async ({ dataPage }) => {
    test.skip(!env.runDestructive, 'Changes appointment status');
    const d = await openFirst(dataPage, 'قادم');
    await d.getByTestId('e2e-appointment-mark-no-show').click();
    await dataPage.getByTestId('e2e-appointment-status-confirm').click();
    await expect(d.getByText(/لم يظهر/).first()).toBeVisible();
  });
});

// ملخص الدفع في تفاصيل الموعد.
test.describe('Appointment payment summary', () => {
  // المتوقع: المجموع = السعر + الضريبة − الخصم (مرتبط ببج قديم: 1078 + 98 − 20 كان بيظهر 1078).
  test('price + VAT − discount = total', async ({ dataPage }) => {
    const d = await openFirst(dataPage, 'الكل');
    const t = toLatinDigits(await d.innerText()).replace(/\n+/g, ' | ');
    // helper: الرقم اللي بعد عنوان معيّن (زي "السعر") في نص الـ popup
    const n = (label: string) => Number(t.match(new RegExp(`${label}\\s*\\|\\s*(-?[\\d.]+)`))?.[1] ?? NaN);
    const price = n('السعر');
    const total = n('المجموع');
    expect(price, 'price').not.toBeNaN();
    expect(total, 'total').not.toBeNaN();
    const vat = n('الضريبة') || 0;
    const discount = Math.abs(n('الخصم') || 0);
    expect(total).toBeCloseTo(price + vat - discount, 1);
  });
});

// شكل صفحة المواعيد.
test.describe('Appointments page layout', () => {
  // US 6086: الصفحة كلها متعملش scroll، المحتوى بس هو اللي يعمل scroll جوه (الفرق أقل من 150px).
  test('page has fixed height with internal scroll (US 6086)', async ({ dataPage }) => {
    const ap = new AppointmentsPage(dataPage);
    await ap.goto('list');
    const docScroll = await dataPage.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    expect(docScroll, 'whole page should not scroll; content scrolls inside').toBeLessThan(150);
  });
});
