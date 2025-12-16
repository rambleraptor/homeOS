/**
 * Authentication E2E Tests - Login
 */

import { test, expect } from '../../fixtures/pocketbase.fixture';
import { LoginPage } from '../../pages/LoginPage';
import { DashboardPage } from '../../pages/DashboardPage';
import { testUsers } from '../../fixtures/test-data';

test.describe('Login', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
  });

  test('should login with valid credentials', async ({ page, testUser }) => {
    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);

    // Should redirect to dashboard
    await dashboardPage.expectToBeOnDashboard();
  });

  test('should show error with invalid email', async ({ page, pocketbase }) => {
    // Create a test user first
    await pocketbase.collection('users').create({
      email: testUsers.user1.email,
      password: testUsers.user1.password,
      passwordConfirm: testUsers.user1.passwordConfirm,
    });

    await loginPage.goto();
    await loginPage.login('wrong@test.local', testUsers.user1.password);

    // Should show error
    await loginPage.expectLoginError(/invalid|incorrect|failed/i);
  });

  test('should show error with invalid password', async ({ page, testUser }) => {
    await loginPage.goto();
    await loginPage.login(testUser.email, 'WrongPassword123!');

    // Should show error
    await loginPage.expectLoginError(/invalid|incorrect|failed/i);
  });

  test('should remain on login page after failed login', async ({ page, testUser }) => {
    await loginPage.goto();
    await loginPage.login(testUser.email, 'WrongPassword123!');

    // Should still be on login page
    await loginPage.expectToBeOnLoginPage();
  });
});
