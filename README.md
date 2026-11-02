# KIWI Provider – Automation Testing

Hi 👋 This repo holds the end-to-end tests for the **KIWI Business Owner (Provider) website** on staging (`https://staging-web.mykiwi.vip`).
They're written with **Playwright + TypeScript** by the QA team at MoonTech.

In short, every run does two things:

1. **Onboarding:** it signs up a brand-new provider from zero and builds a full store for them:
   - the store, a branch and working hours;
   - 2 services and 2 workers;
   - a product with an image and a 15% discount;
   - a logo, a cover and gallery photos;
   - a profile photo and an email.
2. **Provider:** it goes through every screen of the provider website on that same new account:
   - login / OTP, profile and dashboard;
   - catalog, products and workers;
   - appointments, orders and reports;
   - wallet, subscription & pricing and discounts;
   - customers and working hours;
   - a health check on every page.

No fixed test accounts and no manual data. Each run starts clean and checks data it created itself.

---

## What you need

- **Node.js 20 or newer** → <https://nodejs.org> (type `node -v` to check)
- **Git**
- Internet access to `staging-web.mykiwi.vip` and `staging.mykiwi.vip`

## Install it (one time only)

```bash
git clone https://github.com/2laamohamed/Kiwi-provider-Automation-Testing.git
cd Kiwi-provider-Automation-Testing

npm ci                              # installs the packages
npx playwright install chromium     # installs the browser
cp .env.example .env                # on Windows cmd: copy .env.example .env
```

**On Windows** there's a shortcut: just double-click **`setup.bat`**. It does all of the above and checks that everything compiles.

You don't need to change anything in `.env`, because the defaults already point to staging. No passwords are needed: login uses a phone number and the staging test OTP `9999`.

## Run it

### Without opening a browser (headless, the fastest)

```bash
npm run test:headless
```

This runs onboarding first and then all the provider tests.

### Watching the browser while it runs

```bash
npm run test:all
```

Same thing, but you can see every step on screen.

### Only one part

```bash
npm run test:onboarding            # only the new-provider journey
npm run test:provider              # only the provider screens (needs an onboarding run first)
npm run test:onboarding:headless
npm run test:provider:headless
npm run test:ui                    # Playwright UI: pick a single test and debug it
```

### See the report

```bash
npm run report
```

The report opens in your browser. If something failed, click the test to see its **screenshot, video and trace** (a step-by-step replay of what happened).

> ⏱️ Staging can be slow, so give a full run some time, because onboarding builds a whole account from scratch.

---

## How a run works

1. **onboarding** signs up a new provider with a random `1550xxxxxx` number (OTP `9999`), creates all the data above, and saves the session in a local `.auth/` folder. That folder is never pushed to GitHub.
2. **provider-setup** logs in to that same account.
3. **provider** runs every screen on it.

That's why onboarding always goes first. `npm run test:all` and `npm run test:headless` already handle that for you.

A couple of things that are good to know:

- **OTP limit:** the server sends one OTP per minute per number. When it says "please wait", the tests wait about a minute and try again on their own, so a few tests take longer on purpose. Please don't run two copies at the same time.
- **Appointments:** customers make bookings from the customer app, so a brand-new account has none yet. The appointment-details tests are **skipped with a clear reason** in that case, and they run by themselves once the account has a booking.

---

## Reading the results

- ✅ **Passed**: all good.
- 🐞 **Known bug (expected to fail):** it's marked with `test.fail()` and counts as passed while the bug is still there. It's listed at the end of every run.

  | Bug | Where | What's wrong |
  |---|---|---|
  | **L4** | onboarding, add-service dialog | Under "مجموعة الخدمات" the error says "فئة العمل مطلوبة". |

  Once it's fixed, the test turns red with **"passed unexpectedly"**. That's good news: just delete that `test.fail()` line.

- ⏭️ **Skipped:** the reason is printed at the end of the run. Right now staging has **only the free plan**, so the checks that need a paid plan are skipped. They'll run again as soon as paid plans are back.
- 🟡 **Flaky:** a test failed once and passed on the automatic retry. On staging that's almost always a short network drop.

### Tests that don't run by default

| Tag | Why | How to run them |
|---|---|---|
| `@destructive` | They change real data (for example, marking an appointment as "No show"). | `npm run test:destructive` |
| `@needs-data` | They need data a new account doesn't have yet (orders, paid-plan invoices, wallet balance). | `npm run test:needs-data` |

---

## What's inside

```
playwright.config.ts        projects (onboarding, provider-setup, provider), timeouts, retries, reports
.env.example                settings – copy it to .env
setup.bat                   one-click setup for Windows
src/
  config/                   reads .env, OTP settings
  fixtures/                 login and saved sessions
  pages/provider/           one Page Object per screen (uses the site's e2e data-testids)
  utils/                    API helper, page health checks, popups, image upload, texts
tests/
  onboarding/               the new-provider journey
  provider/                 the provider screens (01 … 15)
  assets/                   image used for uploads
```

Other handy commands:

```bash
npm run typecheck        # check the TypeScript
npm run test:smoke       # a quick smoke run
npm run auth:provider    # force a fresh login
```

**Settings:**

- Desktop Chrome at 1440×900, Arabic (ar-EG), Cairo time.
- 2 workers.
- 3 minutes per test.
- Provider tests retry once. Onboarding never retries, so it doesn't create two accounts.

---

## بالعربي باختصار

1. التسطيب: `npm ci`، بعدها `npx playwright install chromium`، بعدها انسخ `.env.example` باسم `.env`. على ويندوز ممكن تدوس دبل كليك على `setup.bat` وهو يعمل الخطوات دي كلها.
2. التشغيل من غير ما المتصفح يفتح: `npm run test:headless`. ولو عايز تتفرج على المتصفح وهو شغال: `npm run test:all`.
3. التقرير: `npm run report`.
4. كل رن بيعمل حساب بروفايدر جديد وداتا جديدة، وتستات البروفايدر بتكمّل على الحساب ده.
5. الباج المعروف (L4) بيتحسب ناجح لحد ما تتصلح. والتستات اللي عليها skip مكتوب سببها في آخر الرن.
