/**
 * ريبورتر صغير بيتضاف جنب الـ list والـ html.
 * 1) لما أي تست يتعمل skip بيكتب في الآخر في الترمينال اسم التست والسبب بالظبط،
 *    عشان مايبقاش فيه تست اتعمله skip من غير ما تعرفي ليه.
 * 2) التستات المتعلّمة بـ test.fail() (بجز معروفة) بيكتبها في الآخر في قايمة "بجز معروفة":
 *    - فشلت زي المتوقع ← البج لسه موجود (والرن أخضر).
 *    - نجحت ← غالباً البج اتصلح، شيلي سطر test.fail() بتاعها.
 */
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

export default class SkipReasonReporter implements Reporter {
  private lines: string[] = [];
  private bugs: string[] = [];

  // بيتنادى بعد كل تست: لو التست اتعمله skip بنحفظ اسمه وسببه
  onTestEnd(test: TestCase, result: TestResult): void {
    // بج معروف (test.fail): بنسجّل هل لسه موجود ولا اتصلح
    if (test.expectedStatus === 'failed' && result.status !== 'skipped') {
      const id = [...test.annotations, ...result.annotations]
        .map((a) => a.type.match(/^known bug (\S+)/)?.[1])
        .find(Boolean);
      const name = test.titlePath().filter(Boolean).slice(1).join(' › ');
      const state = result.status === 'failed' ? 'لسه موجود' : 'التست نجح – غالباً اتصلح، شيلي test.fail()';
      this.bugs.push(`  - ${id ?? '?'}: ${name}\n      ${state}`);
      return;
    }
    if (result.status !== 'skipped') {
      return;
    }
    const reasons = [...test.annotations, ...result.annotations]
      .filter((a) => a.type === 'skip' || a.type === 'fixme')
      .map((a) => a.description)
      .filter(Boolean);
    const reason = [...new Set(reasons)].join(' / ') || 'من غير سبب مكتوب';
    this.lines.push(`  - ${test.titlePath().filter(Boolean).slice(1).join(' › ')}\n      السبب: ${reason}`);
  }

  // في آخر الرن: بنطبع كل التستات اللي اتعملها skip مع السبب
  onEnd(): void {
    if (this.bugs.length > 0) {
      console.log(
        `\nبجز معروفة (${this.bugs.length}) – متعلّمة "expected to fail":\n${this.bugs.join('\n')}\n`,
      );
    }
    if (this.lines.length === 0) {
      return;
    }
    console.log(
      `\nالتستات اللي اتعملها skip (${this.lines.length}) وسبب كل واحد:\n${this.lines.join('\n')}\n`,
    );
  }

  // مش بيطبع حاجة أثناء الرن نفسه، فالـ list reporter يفضل شغال عادي
  printsToStdio(): boolean {
    return false;
  }
}
