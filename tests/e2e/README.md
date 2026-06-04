# Homestead End-to-End Tests

Comprehensive end-to-end tests for Homestead using Playwright against a
real aepbase backend.

## Overview

These tests verify the full integration of the Homestead application,
exercising the Vite + React frontend, the Bun sidecar, and the aepbase
backend together in a real browser environment.

### What's Tested

- **Authentication** - Login, logout, session persistence
- **Gift Cards** - CRUD operations, merchant summaries
- **Events** - CRUD operations, recurring events
- **Settings** - Password changes, validation
- **Navigation** - Module navigation, routing, 404 handling

## Architecture

### Directory Structure

```
tests/e2e/                            # Cross-cutting test plumbing
├── config/
│   ├── aepbase.setup.ts              # aepbase test instance management
│   └── dev-server.setup.ts           # Vite dev server bootstrap
├── fixtures/
│   ├── aepbase.fixture.ts            # Auth + user/admin Playwright fixtures
│   └── test-data.ts                  # `testUsers` (cross-cutting only)
├── pages/                            # Core Page Object Models
│   ├── LoginPage.ts
│   ├── DashboardPage.ts
│   ├── SettingsPage.ts
│   ├── UsersPage.ts
│   └── FlagManagementPage.ts
├── tests/                            # Core specs (auth, nav, settings, …)
│   ├── auth/
│   ├── flag-management/
│   ├── navigation/
│   ├── offline/
│   ├── settings/
│   └── users/
├── utils/
│   ├── aepbase-helpers.ts            # Generic REST primitives only
│   └── test-helpers.ts
├── package.json
├── playwright.config.ts              # Discovers specs under both roots
├── tsconfig.json
└── README.md

packages/homestead-modules/<module>/  # Module-owned e2e artifacts
└── e2e/
    ├── <Module>Page.ts               # Module POM
    ├── helpers.ts                    # Seed helpers + test data
    └── <module>-*.spec.ts            # Specs
```

Playwright `testDir` is the repo root; `testMatch` covers both
`tests/e2e/tests/**/*.spec.ts` and
`packages/homestead-modules/**/e2e/**/*.spec.ts`.

### Test Infrastructure

#### aepbase Test Instance

Each test run:
1. Creates a fresh aepbase instance on port 8092
2. Applies the declared resource definitions via the shared schema sync
3. Seeds initial data (admin user)
4. Runs tests against this isolated instance
5. Tears down after completion

#### Fixtures

**`userToken`** - Authenticated bearer token for direct aepbase REST calls

```typescript
test('example', async ({ userToken }) => {
  await aepCreate(userToken, 'gift-cards', { ... });
});
```

**`testUser`** - A created test user with credentials

```typescript
test('example', async ({ testUser }) => {
  // testUser.email, testUser.password, testUser.id
});
```

**`authenticatedPage`** - A browser page with logged-in user

```typescript
test('example', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/gift-cards');
  // Already authenticated
});
```

## Running Tests

### Prerequisites

1. **Install Dependencies**

```bash
cd tests/e2e
npm install
```

2. **Install Playwright Browsers**

```bash
npx playwright install chromium
```

3. **Ensure Frontend Dev Server is Available**

The tests expect the frontend to be running at `http://localhost:5173`. The Playwright config will start it automatically, but you can also run it manually:

```bash
cd frontend
npm run dev
```

### Run All Tests

```bash
npm test
```

### Run Specific Test Suites

```bash
# Authentication tests only
npm run test:auth

# Gift cards tests only
npm run test:gift-cards

# Events tests only
npm run test:events

# Settings tests only
npm run test:settings

# Navigation tests only
npm run test:navigation
```

### Run in UI Mode (Interactive)

```bash
npm run test:ui
```

This opens a browser where you can:
- See tests execute in real-time
- Inspect each step
- Debug failures
- Re-run specific tests

### Run in Headed Mode (Watch Browser)

```bash
npm run test:headed
```

### Debug Mode

```bash
npm run test:debug
```

Opens the Playwright Inspector for step-by-step debugging.

### View Test Report

```bash
npm run report
```

Opens the HTML report showing test results, screenshots, and videos of failures.

## Writing Tests

### Basic Test Structure

Module specs live at `packages/homestead-modules/<module>/e2e/`. The
shared fixture, generic REST helpers, and core POMs live under
`tests/e2e/`, so module specs import them via a relative path.

```typescript
// packages/homestead-modules/gift-cards/e2e/gift-card-crud.spec.ts
import { test, expect } from '../../../../tests/e2e/fixtures/aepbase.fixture';
import { aepGet } from '../../../../tests/e2e/utils/aepbase-helpers';
import { GiftCardsPage } from './GiftCardsPage';
import { createGiftCard, deleteAllGiftCards, testGiftCards } from './helpers';

test.describe('Gift Cards CRUD', () => {
  let giftCardsPage: GiftCardsPage;

  test.beforeEach(async ({ authenticatedPage, userToken }) => {
    giftCardsPage = new GiftCardsPage(authenticatedPage);
    await deleteAllGiftCards(userToken);
    await giftCardsPage.goto();
  });

  test('should edit a gift card', async ({ userToken }) => {
    const created = await createGiftCard(userToken, testGiftCards[0]);
    // … exercise the UI …
    const updated = await aepGet<{ amount: number }>(userToken, 'gift-cards', created.id);
    expect(updated.amount).toBe(75);
  });
});
```

### Using Page Object Models

Page Objects encapsulate page interactions:

```typescript
// Good - Use Page Object
await giftCardsPage.createGiftCard({
  merchant: 'Amazon',
  amount: 50,
});

// Bad - Direct DOM manipulation
await page.getByRole('button', { name: /add/i }).click();
await page.getByLabel(/merchant/i).fill('Amazon');
// ... etc
```

### Seeding data via aepbase REST

For tests that need existing data, import the module's seed helpers
from its colocated `e2e/helpers.ts`:

```typescript
import { createGiftCard, deleteAllGiftCards } from './helpers';

test.beforeEach(async ({ userToken }) => {
  await deleteAllGiftCards(userToken);
});

test('should edit gift card', async ({ userToken }) => {
  await createGiftCard(userToken, { merchant: 'Amazon', amount: 50 });
  await giftCardsPage.editGiftCard('Amazon', { amount: 75 });
});
```

Need a primitive that the module helpers don't expose (e.g. `aepGet`
or `aepList`)? Import it directly from
`../../../../tests/e2e/utils/aepbase-helpers`.

## Best Practices

### 1. Use Fixtures

✅ **Do:**
```typescript
test('example', async ({ authenticatedPage, userToken }) => {
  // Use provided fixtures
});
```

❌ **Don't:**
```typescript
test('example', async ({ page }) => {
  // Manually login every time
  await page.goto('/login');
  // ...
});
```

### 2. Use Page Objects

✅ **Do:**
```typescript
await giftCardsPage.createGiftCard({ merchant: 'Amazon', amount: 50 });
```

❌ **Don't:**
```typescript
await page.getByRole('button', { name: /add/i }).click();
await page.getByLabel(/merchant/i).fill('Amazon');
```

### 3. Seed Data via API

✅ **Do:**
```typescript
await createMultipleGiftCards(userToken, cards);
await giftCardsPage.goto();
```

❌ **Don't:**
```typescript
for (const card of cards) {
  await giftCardsPage.createGiftCard(card); // Slow UI interaction
}
```

### 4. Test One Thing Per Test

✅ **Do:**
```typescript
test('should create gift card', async () => { ... });
test('should edit gift card', async () => { ... });
```

❌ **Don't:**
```typescript
test('should create, edit, delete gift card', async () => { ... });
```

### 5. Use Descriptive Test Names

✅ **Do:**
```typescript
test('should reject weak password', async () => { ... });
```

❌ **Don't:**
```typescript
test('password test', async () => { ... });
```

## Troubleshooting

### Tests Fail with "Connection Refused"

aepbase failed to start. Check:
- Port 8092 is not in use
- The `aepbase/bin/aepbase` binary built successfully
- Schema sync logged no errors during bootstrap

### Tests Timeout

Frontend not running or slow to start. Check:
- `npm run dev` works in `frontend/`
- Port 5173 is accessible
- No build errors

### "Cannot find module" Errors

TypeScript configuration issue:
```bash
npm install
```

### Flaky Tests

Tests sometimes pass, sometimes fail:
- Add explicit waits: `await page.waitForURL(...)`
- Use `waitForLoadState('networkidle')`
- Increase timeout for slow operations

## CI/CD Integration

Tests are designed to run in GitHub Actions. See `.github/workflows/e2e-tests.yml` for the CI configuration.

### Running in CI

```yaml
- name: Run E2E Tests
  run: cd tests/e2e && npm test
```

CI automatically:
- Installs dependencies
- Builds the aepbase binary
- Starts frontend dev server
- Starts the aepbase test instance
- Runs all tests
- Uploads failure artifacts (screenshots, videos, traces)

## Performance

### Test Execution Time

Typical test run times:
- Auth tests: ~10-15 seconds
- Gift cards tests: ~20-30 seconds
- Events tests: ~15-20 seconds
- Settings tests: ~10-15 seconds
- Navigation tests: ~10-15 seconds

**Total: ~2-3 minutes for full suite**

### Optimization Tips

1. **Run tests in parallel** (when safe):
   ```typescript
   test.describe.configure({ mode: 'parallel' });
   ```

2. **Seed data via API** instead of UI interactions

3. **Use specific selectors** to avoid unnecessary retries

4. **Skip browser downloads** for specific tests:
   ```typescript
   test.use({ viewport: null }); // No viewport = faster
   ```

## Contributing

When adding new features:

1. Add tests for critical user flows
2. Use existing page objects or create new ones
3. Follow the established patterns
4. Run tests locally before pushing
5. Ensure tests pass in CI

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Homestead CLAUDE.md](../../CLAUDE.md) - Project guidelines
