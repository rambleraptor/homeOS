# HomeOS End-to-End Tests

Comprehensive end-to-end tests for HomeOS using Playwright and PocketBase.

## Overview

These tests verify the full integration of the HomeOS application, testing both the React frontend and PocketBase backend together in a real browser environment.

### What's Tested

- **Authentication** - Login, logout, session persistence
- **Gift Cards** - CRUD operations, merchant summaries
- **Events** - CRUD operations, recurring events
- **Settings** - Password changes, validation
- **Navigation** - Module navigation, routing, 404 handling

## Architecture

### Directory Structure

```
tests/e2e/
├── config/
│   ├── pocketbase.setup.ts    # PocketBase test instance management
│   └── playwright.config.ts   # Playwright configuration (symlink)
├── fixtures/
│   ├── pocketbase.fixture.ts  # Custom PocketBase fixtures
│   └── test-data.ts            # Test data definitions
├── pages/                      # Page Object Models
│   ├── LoginPage.ts
│   ├── DashboardPage.ts
│   ├── GiftCardsPage.ts
│   ├── EventsPage.ts
│   └── SettingsPage.ts
├── tests/                      # Test suites
│   ├── auth/
│   │   ├── login.spec.ts
│   │   ├── logout.spec.ts
│   │   └── session-persistence.spec.ts
│   ├── gift-cards/
│   │   ├── gift-card-crud.spec.ts
│   │   └── merchant-summary.spec.ts
│   ├── events/
│   │   └── event-crud.spec.ts
│   ├── settings/
│   │   └── change-password.spec.ts
│   └── navigation/
│       └── module-navigation.spec.ts
├── utils/                      # Helper utilities
│   ├── pocketbase-helpers.ts  # Direct PB API helpers
│   └── test-helpers.ts         # General test utilities
├── package.json
├── playwright.config.ts
├── tsconfig.json
└── README.md
```

### Test Infrastructure

#### PocketBase Test Instance

Each test run:
1. Creates a fresh PocketBase instance on port 8092
2. Applies all migrations from `pb_migrations/`
3. Seeds initial data (admin user)
4. Runs tests against this isolated instance
5. Tears down after completion

#### Fixtures

**`pocketbase`** - Authenticated PocketBase client for direct API access

```typescript
test('example', async ({ pocketbase }) => {
  await pocketbase.collection('gift_cards').create({...});
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

```typescript
import { test, expect } from '../../fixtures/pocketbase.fixture';
import { GiftCardsPage } from '../../pages/GiftCardsPage';

test.describe('Feature Name', () => {
  let giftCardsPage: GiftCardsPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    giftCardsPage = new GiftCardsPage(authenticatedPage);
    await giftCardsPage.goto();
  });

  test('should do something', async ({ page, pocketbase }) => {
    // Arrange: Set up test data via PB API
    await pocketbase.collection('gift_cards').create({...});

    // Act: Perform actions via page object
    await giftCardsPage.createGiftCard({...});

    // Assert: Verify expected behavior
    await giftCardsPage.expectGiftCardInList('Amazon');
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

### Seeding Data via PocketBase API

For tests that need existing data, use PocketBase helpers:

```typescript
import { createGiftCard, createMultipleGiftCards } from '../../utils/pocketbase-helpers';

test('should edit gift card', async ({ pocketbase }) => {
  // Seed data via API (faster than UI)
  await createGiftCard(pocketbase, {
    merchant: 'Amazon',
    amount: 50,
  });

  // Test UI behavior
  await giftCardsPage.editGiftCard('Amazon', { amount: 75 });
});
```

### Cleaning Up Test Data

```typescript
import { deleteAllGiftCards } from '../../utils/pocketbase-helpers';

test.beforeEach(async ({ pocketbase }) => {
  // Clean slate for each test
  await deleteAllGiftCards(pocketbase);
});
```

## Best Practices

### 1. Use Fixtures

✅ **Do:**
```typescript
test('example', async ({ authenticatedPage, pocketbase }) => {
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
await createMultipleGiftCards(pocketbase, cards);
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

PocketBase failed to start. Check:
- Port 8092 is not in use
- PocketBase binary downloaded correctly
- Migrations are valid

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
- Downloads PocketBase
- Starts frontend dev server
- Starts PocketBase test instance
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
- [PocketBase Documentation](https://pocketbase.io/docs)
- [HomeOS CLAUDE.md](../../CLAUDE.md) - Project guidelines
