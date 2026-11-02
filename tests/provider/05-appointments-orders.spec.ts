// تستات المواعيد والطلبات في داشبورد البروفايدر.
// الشاشات: المواعيد  /dashboard?tab=appointments  (عرض يومي / عرض التقويم / عرض القائمة + تابات الحالة:
// الكل، قادم، قيد التنفيذ، مكتمل، ملغي، لم يظهر)  ،  الطلبات  /dashboard?tab=orders  (تابات حالة الطلب).
// User stories: Appointments (daily / calendar / list + status tabs), Orders.
// تستات "data integrity" بتستخدم dataPage (حساب فيه مواعيد حقيقية، PROVIDER_DATA_PHONE أو الحساب الأساسي).
import { test, expect } from '../../src/fixtures/provider.fixture';
import { AR } from '../../src/utils/texts';
import { cairoToday, toLatinDigits } from '../../src/utils/data';
import { AppointmentsPage } from '../../src/pages/provider/OperationsPages';
import { expectNoNullText, expectNoRawI18nKeys } from '../../src/utils/pageHealth';

// مجموعة تستات صفحة المواعيد (شكل الصفحة والتابات).
test.describe('Appointments', () => {
  // الصفحة بتفتح وفيها أزرار الـ 3 عروض (يومي / تقويم / قائمة)، ومفيش مفاتيح ترجمة خام ولا errors.
  test('appointments page loads with 3 views @smoke', async ({ appointments, health, page }) => {
    await appointments.goto('calendar');
    for (const v of ['daily', 'calendar', 'list'] as const) {
      await expect(appointments.viewButton(v)).toBeVisible();
    }
    await expectNoRawI18nKeys(page);
    await health.expectHealthy();
  });

  // عرض القائمة لازم يظهر كل تابات الحالة (الكل، قادم، قيد التنفيذ، مكتمل، ملغي، لم يظهر).
  test('list view shows all status tabs', async ({ appointments }) => {
    await appointments.goto('list');
    for (const t of AR.appointments.tabs) {
      await expect(appointments.statusTab(t)).toBeVisible();
    }
  });

  // كل تاب حالة (غير "الكل") لازم يعرض مواعيد بنفس الحالة بس.
  // بعد الضغط على التاب بنستنى الجدول يخلص تحميل (التاب بيبقى disabled والجدول بيعرض صفوف التاب القديم
  // حوالي نص ثانية)، والمواعيد المتوقعة لكل تاب بنجيبها من الـ API.
  // لو فيه صف حالته مختلفة التست بيفشل ويكتب أرقام المواعيد الغلط.
  test('each status tab only shows rows of that status', async ({ appointments }) => {
    await appointments.goto('list');
    for (const t of AR.appointments.tabs.slice(1)) {
      const expected = new Set((await appointments.apiReservations(t)).map((r) => r.number));
      await appointments.selectStatus(t);
      await appointments.waitForList(t, expected);
      const rows = await appointments.readListRows();
      const wrong = rows.filter((r) => r.status && r.status !== t);
      expect(
        wrong,
        `Tab "${t}" shows rows with other statuses: ${wrong.map((r) => r.id).join(', ')}`,
      ).toEqual([]);
    }
  });

  // التنقل بين العروض (يومي ← قائمة ← تقويم): المتوقع الصفحة تفضل سليمة من غير crash.
  test('switching views keeps the page healthy', async ({ appointments, health }) => {
    await appointments.goto('calendar');
    for (const v of ['daily', 'list', 'calendar'] as const) {
      await appointments.viewButton(v).click();
      await appointments.page.waitForTimeout(1000);
    }
    await health.expectHealthy();
  });

  // العرض اليومي بيفتح على النهارده (بتوقيت القاهرة): عنوان الشهر لازم فيه السنة واسم الشهر الحالي بالعربي.
  test('daily view defaults to today and month title matches', async ({ appointments }) => {
    await appointments.goto('calendar');
    await appointments.viewButton('daily').click();
    const [y, m] = cairoToday().split('-');
    const title = await appointments.monthTitle();
    expect(title).toContain(y);
    // أسماء الشهور بالعربي بالترتيب (يناير = 1).
    const months = [
      'يناير',
      'فبراير',
      'مارس',
      'أبريل',
      'مايو',
      'يونيو',
      'يوليو',
      'أغسطس',
      'سبتمبر',
      'أكتوبر',
      'نوفمبر',
      'ديسمبر',
    ];
    expect(title).toContain(months[Number(m) - 1]);
  });

  // عرض القائمة: مفيش اسم عميل أو عامل بيظهر "null".
  test('list view: no null customer/worker names', async ({ appointments, page }) => {
    await appointments.goto('list');
    await expectNoNullText(page);
  });
});

// تستات صحة الداتا في المواعيد – محتاجة حساب فيه مواعيد (dataPage).
test.describe('Appointments – data integrity (needs data account)', () => {
  // عدد مواعيد النهارده في العرض اليومي لازم يساوي عددها في عرض القائمة.
  test('daily count for today equals list count for today', async ({ dataPage }) => {
    const ap = new AppointmentsPage(dataPage);
    const today = cairoToday();
    await ap.goto('list');
    const [y, m, d] = today.split('-');
    const listToday = (await ap.readListRows()).filter((r) => r.date === `${d}-${m}-${y}`);
    await ap.goto('calendar', today);
    await ap.viewButton('daily').click();
    await dataPage.waitForTimeout(2000);
    const dailyCount = await ap.dailyCards.count();
    expect(dailyCount, 'Daily view and list view disagree on today').toBe(listToday.length);
  });

  // نفس العامل مينفعش يبقى عنده موعدين نشطين (قادم / قيد التنفيذ) متداخلين في نفس اليوم والوقت.
  // لو فيه تداخل التست بيفشل ويكتب أرقام المواعيد المتداخلة واسم العامل.
  test('a worker has no overlapping active appointments', async ({ dataPage }) => {
    const ap = new AppointmentsPage(dataPage);
    await ap.goto('list');
    const rows = (await ap.readListRows()).filter(
      (r) => r.worker && r.time && /قادم|قيد التنفيذ/.test(r.status),
    );
    // helper: بيحوّل وقت زي "10:30 م" لعدد دقايق من أول اليوم (ص = صباحًا، م = مساءً).
    const toMin = (t: string) => {
      const mm = toLatinDigits(t).match(/(\d{1,2}):(\d{2})\s*([صم])/);
      return mm ? ((Number(mm[1]) % 12) + (mm[3] === 'م' ? 12 : 0)) * 60 + Number(mm[2]) : NaN;
    };
    const overlaps: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i],
          b = rows[j];
        if (a.worker !== b.worker || a.date !== b.date) {
          continue;
        }
        const [as, ae] = a.time.split('-').map(toMin);
        const [bs, be] = b.time.split('-').map(toMin);
        if (as < be && bs < ae) {
          overlaps.push(`${a.id} ↔ ${b.id} (${a.worker} ${a.date})`);
        }
      }
    }
    expect(overlaps, 'Overlapping bookings for the same worker').toEqual([]);
  });
});

// مجموعة تستات صفحة الطلبات.
test.describe('Orders', () => {
  // الصفحة بتفتح وكل تابات الحالة ظاهرة (الكل، تم الاستلام، قيد التحضير، جاهز، تم التسليم، ملغي).
  test('orders page loads with status tabs @smoke', async ({ orders, health }) => {
    await orders.goto();
    for (const t of AR.orders.tabs) {
      await expect(orders.tab(t)).toBeVisible();
    }
    await health.expectHealthy();
  });

  // الضغط على كل تاب: المتوقع مفيش crash ولا كلمة "null" في الصفحة.
  test('each order tab opens without crash', async ({ orders, health, page }) => {
    await orders.goto();
    for (const t of AR.orders.tabs) {
      await orders.tab(t).click();
      await page.waitForTimeout(1000);
    }
    await expectNoNullText(page);
    await health.expectHealthy();
  });
});
