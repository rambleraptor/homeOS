/**
 * Health E2E Tests - Vaccination CRUD
 */

import { test, expect } from '../../../../tests/e2e/fixtures/aepbase.fixture';
import { HealthPage } from './HealthPage';
import {
  createVaccination,
  deleteAllVaccinations,
  getVaccination,
  testVaccinations,
} from './helpers';

test.describe('Health CRUD', () => {
  let healthPage: HealthPage;

  test.beforeEach(async ({ authenticatedPage, userToken }) => {
    healthPage = new HealthPage(authenticatedPage);

    // Clean up this user's own records (the private model scopes the list).
    await deleteAllVaccinations(userToken);

    await healthPage.goto();
  });

  test('shows the empty state with no records', async () => {
    await healthPage.expectEmptyState();
  });

  test('creates a new vaccination record', async () => {
    const record = testVaccinations[1];

    await healthPage.createVaccination(record);

    await healthPage.expectVaccinationInList(record.vaccine);
  });

  test('creates multiple vaccination records', async () => {
    for (const record of testVaccinations) {
      await healthPage.createVaccination(record);
    }

    for (const record of testVaccinations) {
      await healthPage.expectVaccinationInList(record.vaccine);
    }
  });

  test('edits an existing vaccination record', async ({ userToken }) => {
    const created = await createVaccination(userToken, testVaccinations[1]);

    await healthPage.goto();
    await healthPage.expectVaccinationInList(testVaccinations[1].vaccine);

    await healthPage.editVaccination(testVaccinations[1].vaccine, {
      provider: 'Kaiser',
      dose: '2 of 2',
    });

    const updated = await getVaccination(userToken, created.id);
    expect(updated.provider).toBe('Kaiser');
    expect(updated.dose).toBe('2 of 2');
  });

  test('deletes a vaccination record', async ({ userToken }) => {
    await createVaccination(userToken, testVaccinations[0]);

    await healthPage.goto();
    await healthPage.expectVaccinationInList(testVaccinations[0].vaccine);

    await healthPage.deleteVaccination(testVaccinations[0].vaccine);

    await healthPage.expectVaccinationNotInList(testVaccinations[0].vaccine);
  });

  test('surfaces an overdue next dose in the due-soon strip', async ({ userToken }) => {
    await createVaccination(userToken, {
      vaccine: 'Hepatitis B',
      date_administered: '2020-01-15',
      next_due: '2021-01-15', // long past — always overdue
    });

    await healthPage.goto();
    await healthPage.expectDueSoonStrip('Hepatitis B');
  });
});
