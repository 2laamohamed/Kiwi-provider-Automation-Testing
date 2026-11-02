/**
 * Page objects صفحات التشغيل اليومي في موقع البروفايدر:
 * المواعيد (/dashboard?tab=appointments – يومي/تقويم/قائمة، التفاصيل، إكمال موعد كاش)،
 * الطلبات /ar/dashboard?tab=orders، العملاء /ar/customers، الشكاوى /ar/complaints،
 * وساعات العمل /ar/branches-working-hours.
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { AR } from '../../utils/texts';
import { toLatinDigits } from '../../utils/data';
import { kiwiApi } from '../../utils/kiwiApi';

/** عدد المواعيد في صفحة القائمة (الافتراضي في الموقع: 10) */
const LIST_PAGE_SIZE = 10;

/** أسماء تابات الحالة بالعربي ← المفتاح اللي في الـ data-testid */
export const APPOINTMENT_STATUS: Record<string, string> = {
  الكل: 'all',
  قادم: 'received',
  'قيد التنفيذ': 'in_progress',
  مكتمل: 'completed',
  ملغي: 'cancelled',
  'لم يظهر': 'no_show',
};

/** صفحة المواعيد عند البروفايدر (يومي / تقويم / قائمة) – معمولة على الـ e2e test-ids اللي في الموقع */
export class AppointmentsPage extends BasePage {
  /**
   * بيفتح صفحة المواعيد على العرض المطلوب (ولو حددنا يوم بيفتح عليه).
   * في عرض القائمة بيستنى كمان لحد ما الجدول يخلص تحميل (عدد الصفوف = العدد اللي على تاب "الكل").
   */
  async goto(mode: 'calendar' | 'list' = 'calendar', day?: string): Promise<void> {
    const q = day ? `&calendarDay=${day}` : '';
    await this.open(`/dashboard?tab=appointments&mode=${mode}${q}`);
    await expect(this.page.getByTestId('e2e-appointments-page')).toBeVisible({ timeout: 45_000 });
    if (mode === 'list') {
      await this.waitForList('الكل');
    }
  }

  /** زرار تغيير طريقة العرض: يومي / تقويم / قائمة */
  viewButton(name: 'daily' | 'calendar' | 'list'): Locator {
    return this.page.getByTestId(`e2e-appointments-view-mode-${name}`);
  }

  /** تاب حالة المواعيد – بياخد الاسم بالعربي ("قادم") أو المفتاح ("received") */
  statusTab(name: string): Locator {
    const key = APPOINTMENT_STATUS[name] ?? name;
    return this.page.getByTestId(`e2e-appointments-status-tab-${key}`);
  }

  /** الرقم اللي مكتوب على تاب الحالة (لو مفيش رقم يبقى 0) */
  async statusCount(name: string): Promise<number> {
    const t = toLatinDigits(await this.statusTab(name).innerText());
    const m = t.match(/\d+/);
    return m ? Number(m[0]) : 0;
  }

  /** صفوف جدول عرض القائمة */
  get listRows(): Locator {
    return this.page.getByTestId('e2e-appointments-table').locator('tbody tr');
  }

  /** الـ skeleton اللي بيظهر مكان الجدول وهو بيحمّل (الجدول نفسه بيختفي لحد ما الداتا توصل) */
  get listLoading(): Locator {
    return this.page.getByTestId('e2e-appointments-page').locator('.animate-pulse');
  }

  /** كروت المواعيد (العرض اليومي) */
  get dailyCards(): Locator {
    return this.page.locator('[data-testid^="e2e-appointments-card-"]:not([data-testid*="open-details"])');
  }

  /**
   * مواعيد الحساب من الـ API (/provider/reservations) – كلها أو بحالة معيّنة.
   * بنستخدمها عشان نعرف أي موعد نفتحه بالظبط (id + رقم الحجز) بدل "أول صف ظاهر".
   */
  async apiReservations(status = 'الكل'): Promise<Array<{ id: number; number: string; status: string }>> {
    const key = APPOINTMENT_STATUS[status] ?? status;
    const api = await kiwiApi(this.page, 'provider');
    try {
      const filter = key === 'all' ? '' : `&filter[status]=${key}`;
      const data = await api.get<Array<{ id: number; reservation_number: string; status: string }>>(
        `/reservations?page=1&perPage=50${filter}`,
      );
      return (data ?? []).map((r) => ({ id: r.id, number: r.reservation_number, status: r.status }));
    } finally {
      await api.dispose();
    }
  }

  /**
   * بيستنى جدول القائمة يخلص تحميل للتاب ده:
   * التاب enabled + مفيش skeleton + عدد الصفوف = العدد اللي على التاب (أقصى حاجة 10 في الصفحة)
   * + (لو بعتنا أرقام الحجوزات المتوقعة من الـ API) كل صف ظاهر لازم يكون منهم.
   * ليه؟ بعد الضغط على تاب، الجدول بيفضل عارض صفوف التاب القديم حوالي نص ثانية قبل ما يحمّل الجديد،
   * فلو قرينا أو دوسنا في الوقت ده بنمسك صف غلط (ده كان سبب فشل تستات تفاصيل الموعد).
   */
  async waitForList(name: string, expected?: Set<string>): Promise<void> {
    await expect
      .poll(
        async () => {
          if (await this.statusTab(name).isDisabled()) {
            return 'tab still loading';
          }
          if (await this.listLoading.count()) {
            return 'table still loading';
          }
          const ids = (await this.readListRows()).map((r) => r.id).filter(Boolean);
          const count = Math.min(await this.statusCount(name), LIST_PAGE_SIZE);
          if (ids.length !== count) {
            return `table shows ${ids.length} rows, tab "${name}" says ${count}`;
          }
          const foreign = expected ? ids.filter((id) => !expected.has(id)) : [];
          return foreign.length ? `rows not in "${name}": ${foreign.join(', ')}` : 'ready';
        },
        { timeout: 45_000, message: `appointments list for "${name}" did not finish loading` },
      )
      .toBe('ready');
  }

  /** بيدوس على تاب حالة (بعد ما يبقى enabled – التابات بتبقى disabled وهي بتحمّل) */
  async selectStatus(name: string): Promise<void> {
    const tab = this.statusTab(name);
    await expect(tab).toBeEnabled({ timeout: 45_000 });
    await tab.click();
  }

  /**
   * زرار "عرض التفاصيل" (أيقونة العين) لموعد معيّن أو لأول موعد ظاهر.
   * في عرض القائمة الزرار الظاهر هو e2e-appointments-open-details جوه e2e-appointments-row-actions-<id>،
   * أما e2e-appointments-card-open-details-<id> فده بتاع الكروت (العرض اليومي) وبيبقى مخفي (حجمه 0) في القائمة.
   */
  detailsButton(id?: string | number): Locator {
    if (id) {
      return this.page
        .getByTestId(`e2e-appointments-row-actions-${id}`)
        .getByTestId('e2e-appointments-open-details')
        .or(this.page.locator(`[data-testid="e2e-appointments-card-open-details-${id}"]:visible`))
        .first();
    }
    return this.page
      .locator(
        '[data-testid="e2e-appointments-open-details"]:visible, [data-testid^="e2e-appointments-card-open-details-"]:visible',
      )
      .first();
  }

  /** popup "تفاصيل الموعد" – ولو اديناه رقم الحجز بيرجّع الـ popup بتاع الموعد ده بالظبط */
  detailsDialog(number?: string): Locator {
    const d = this.page
      .getByRole('dialog')
      .filter({ has: this.page.getByTestId('e2e-appointment-details-body') });
    return number ? d.filter({ hasText: number }) : d.last();
  }

  /**
   * بيفتح تفاصيل الموعد ويرجّع الـ popup بتاعه.
   * لو الضغطة ضاعت (الصف اتشال واتحط تاني وقت الضغط) بيضغط تاني لحد دقيقة.
   */
  async openDetails(id?: string | number, number?: string): Promise<Locator> {
    const dialog = this.detailsDialog(number);
    await expect(async () => {
      if (!(await dialog.isVisible())) {
        await this.detailsButton(id).click({ timeout: 10_000 });
      }
      await expect(dialog).toBeVisible({ timeout: 10_000 });
    }).toPass({ timeout: 60_000 });
    await expect(dialog).toContainText(/RS-\d+/);
    return dialog;
  }

  /**
   * بيفتح تفاصيل موعد بحالة معيّنة ("قادم" / "مكتمل" / "الكل") – ولو مفيش موعد بالحالة دي بيرجّع null.
   * الخطوات: يجيب مواعيد الحالة دي من الـ API ← يفتح القائمة ← يدوس التاب ويستنى الجدول يتحدّث بمواعيدها بس
   * ← يفتح تفاصيل أول موعد منهم بالـ id بتاعه ← يرجّع الـ popup اللي فيه رقم الحجز ده بالظبط.
   */
  async openFirstWithStatus(status: string): Promise<Locator | null> {
    const wanted = await this.apiReservations(status);
    if (wanted.length === 0) {
      return null;
    }
    await this.goto('list');
    await this.selectStatus(status);
    await this.waitForList(status, new Set(wanted.map((r) => r.number)));
    const shown = (await this.readListRows()).map((r) => r.id);
    const target = wanted.find((r) => shown.includes(r.number)) ?? wanted[0];
    return this.openDetails(target.id, target.number);
  }

  /**
   * بيكمّل أول موعد "قيد التنفيذ" (أو "قادم" بعد ما يبدأه) والدفع كاش.
   * بيرجّع رقم الموعد RS-… عشان نلاقيه في الأدمن بعد كده.
   */
  async completeFirstWithCash(): Promise<string> {
    await this.goto('list');
    for (const tab of ['in_progress', 'received']) {
      const wanted = await this.apiReservations(tab);
      if (!wanted.length) {
        continue;
      }
      await this.selectStatus(tab);
      await this.waitForList(tab, new Set(wanted.map((r) => r.number)));
      const d = await this.openDetails(wanted[0].id, wanted[0].number);
      const id = toLatinDigits(await d.innerText()).match(/RS-\d+/)?.[0] ?? '';
      // لو الموعد لسه "قادم" لازم نبدأه الأول
      const start = d.getByRole('button', { name: /بدء|ابدأ/ });
      if (await start.count()) {
        await start.first().click();
        await this.page
          .getByRole('button', { name: /تأكيد|نعم/ })
          .last()
          .click()
          .catch(() => undefined);
      }
      await d
        .getByTestId('e2e-appointment-complete')
        .or(d.getByRole('button', { name: 'إكمال الموعد' }))
        .first()
        .click();
      // نختار طريقة الدفع كاش ونأكد
      const cash = this.page
        .getByRole('radio', { name: /كاش|نقد|نقدي|Cash/ })
        .or(this.page.getByRole('button', { name: /كاش|نقد|نقدي|Cash/ }))
        .or(this.page.getByText(/^(كاش|نقدًا|نقداً|نقدي|Cash)$/))
        .first();
      await cash.click();
      await this.page
        .getByRole('button', { name: /تأكيد|إكمال|حفظ/ })
        .last()
        .click();
      await expect(this.page.getByText(/بنجاح|مكتمل/).first()).toBeVisible({ timeout: 30_000 });
      return id;
    }
    throw new Error(
      'مفيش موعد "قادم" أو "قيد التنفيذ" – احجزي موعد من تطبيق العميل بالدفع كاش وشغّلي التست تاني',
    );
  }

  /** عنوان الشهر في العرض اليومي: "أكتوبر ٢٠٢٦" */
  async monthTitle(): Promise<string> {
    const t = await this.page
      .getByText(/(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s+[٠-٩\d]{4}/)
      .first()
      .innerText();
    return toLatinDigits(t.trim());
  }

  /**
   * بيرجّع المواعيد اللي في جدول القائمة: رقم الحجز + التاريخ (dd-mm-yyyy) + الوقت + العامل + الحالة
   */
  async readListRows(): Promise<
    Array<{ id: string; date: string; time: string; worker: string; status: string; raw: string }>
  > {
    const rows = await this.listRows.allInnerTexts();
    return rows.map((raw) => {
      const r = toLatinDigits(raw.replace(/\s+/g, ' '));
      const id = (r.match(/#?(RS-\d+)/) || [])[1] ?? '';
      const date = (r.match(/(\d{2}-\d{2}-\d{4})/) || [])[1] ?? '';
      const time = (r.match(/(\d{1,2}:\d{2}\s*[صم]\s*-\s*\d{1,2}:\d{2}\s*[صم])/) || [])[1] ?? '';
      const status = (r.match(/(لم يظهر|ملغي|مكتمل|قادم|قيد التنفيذ|تم الاستلام)/) || [])[1] ?? '';
      const worker =
        (r.match(/([A-Za-z][A-Za-z ]+employee|[A-Za-z][A-Za-z ]{3,})\s+(أخصائي|عامل)/) || [])[1]?.trim() ??
        '';
      return { id, date, time, worker, status, raw: r };
    });
  }
}

/** أسماء تابات الطلبات بالعربي ← المفتاح اللي في الـ data-testid */
export const ORDER_STATUS: Record<string, string> = {
  الكل: 'all',
  'تم الاستلام': 'received',
  'قيد التحضير': 'preparing',
  جاهز: 'ready',
  'تم التسليم': 'picked_up',
  ملغي: 'canceled',
};

/** صفحة الطلبات /ar/dashboard?tab=orders */
export class OrdersPage extends BasePage {
  /** بيفتح الطلبات على حالة معيّنة (الافتراضي all) ويستنى العنوان */
  async goto(status = 'all'): Promise<void> {
    await this.open(`/ar/dashboard?tab=orders&status=${status}`);
    await expect(this.page.getByText(AR.orders.title).first()).toBeVisible();
  }
  /** تاب حالة الطلبات بالاسم العربي (مثلاً "قيد التحضير") – بالـ data-testid بتاعه */
  tab(name: string): Locator {
    const key = ORDER_STATUS[name] ?? name;
    return this.page.getByTestId(`e2e-orders-status-tab-${key}`);
  }
  /** صفوف جدول الطلبات */
  get rows(): Locator {
    return this.page.locator('table tbody tr');
  }
}

/** صفحة العملاء /ar/customers */
export class CustomersPage extends BasePage {
  /** بيفتح العملاء على الفرع الحالي ويستنى العنوان */
  async goto(): Promise<void> {
    await this.open('/ar/customers?scope=currentBranch');
    await expect(this.page.getByText(AR.customers.title).first()).toBeVisible();
  }
}

/** صفحة الشكاوى /ar/complaints */
export class ComplaintsPage extends BasePage {
  /** بيفتح الشكاوى على الفرع الحالي ويستنى العنوان */
  async goto(): Promise<void> {
    await this.open('/ar/complaints?scope=currentBranch');
    await expect(this.page.getByText(AR.complaints.title).first()).toBeVisible();
  }
}

/** صفحة ساعات العمل /ar/branches-working-hours */
export class WorkingHoursPage extends BasePage {
  /** بيفتح ساعات العمل ويستنى العنوان */
  async goto(): Promise<void> {
    await this.open('/ar/branches-working-hours');
    await expect(this.page.getByText(AR.workingHours.titlePrefix).first()).toBeVisible();
  }

  /** بيرجّع لكل يوم: من/إلى بصيغة 24 ساعة بالدقايق، أو closed */
  async readDays(): Promise<
    Array<{ day: string; from?: number; to?: number; closed: boolean; raw: string }>
  > {
    const days = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
    const body = toLatinDigits(await this.page.locator('body').innerText());
    return days.map((day) => {
      const idx = body.indexOf(day);
      const chunk = idx >= 0 ? body.slice(idx, idx + 60) : '';
      if (chunk.includes(AR.workingHours.closed)) {
        return { day, closed: true, raw: chunk };
      }
      const m = chunk.match(/(\d{1,2}):(\d{2})\s*([صم]).*?(\d{1,2}):(\d{2})\s*([صم])/);
      if (!m) {
        return { day, closed: false, raw: chunk };
      }
      const toMin = (h: string, mm: string, ap: string) =>
        ((Number(h) % 12) + (ap === 'م' ? 12 : 0)) * 60 + Number(mm);
      return { day, from: toMin(m[1], m[2], m[3]), to: toMin(m[4], m[5], m[6]), closed: false, raw: chunk };
    });
  }
}
