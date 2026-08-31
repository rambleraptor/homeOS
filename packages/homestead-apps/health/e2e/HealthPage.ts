/**
 * Health Page Object Model
 */

import { Page, expect } from '@playwright/test';

export interface VaccinationFormInput {
  vaccine: string;
  date_administered: string;
  dose?: string;
  provider?: string;
  lot_number?: string;
  next_due?: string;
  notes?: string;
}

export class HealthPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/health-records');
  }

  async expectToBeOnHealthPage() {
    await expect(this.page).toHaveURL(/\/health-records/);
  }

  async clickAddVaccination() {
    const addButton = this.page.getByTestId('add-vaccination-button');
    await addButton.waitFor({ state: 'visible' });
    await addButton.click();
  }

  async fillVaccinationForm(data: Partial<VaccinationFormInput>) {
    if (data.vaccine !== undefined) {
      await this.page.locator('#vaccine').fill(data.vaccine);
    }
    if (data.date_administered !== undefined) {
      await this.page.locator('#date_administered').fill(data.date_administered);
    }
    if (data.dose !== undefined) {
      await this.page.locator('#dose').fill(data.dose);
    }
    if (data.provider !== undefined) {
      await this.page.locator('#provider').fill(data.provider);
    }
    if (data.lot_number !== undefined) {
      await this.page.locator('#lot_number').fill(data.lot_number);
    }
    if (data.next_due !== undefined) {
      await this.page.locator('#next_due').fill(data.next_due);
    }
    if (data.notes !== undefined) {
      await this.page.locator('#notes').fill(data.notes);
    }
  }

  async submitVaccinationForm() {
    const submitButton = this.page.getByTestId('vaccination-form-submit');
    await submitButton.waitFor({ state: 'visible' });
    await submitButton.click();
    // The form view swaps back to the list once the mutation lands.
    await submitButton.waitFor({ state: 'hidden' });
  }

  async createVaccination(data: VaccinationFormInput) {
    await this.clickAddVaccination();
    await this.fillVaccinationForm(data);
    await this.submitVaccinationForm();
    await this.page.waitForLoadState('networkidle');
  }

  async editVaccination(vaccine: string, newData: Partial<VaccinationFormInput>) {
    const editButton = this.page
      .getByRole('button', { name: `Edit ${vaccine}` })
      .first();
    await editButton.waitFor({ state: 'visible' });
    await editButton.click();

    await this.page.locator('#vaccine').waitFor({ state: 'visible' });
    await this.fillVaccinationForm(newData);
    await this.submitVaccinationForm();
    await this.page.waitForLoadState('networkidle');
  }

  async deleteVaccination(vaccine: string) {
    const deleteButton = this.page
      .getByRole('button', { name: `Delete ${vaccine}` })
      .first();
    await deleteButton.waitFor({ state: 'visible' });
    await deleteButton.click();

    // The confirm dialog's destructive action.
    const confirmButton = this.page.getByRole('button', { name: /^delete$/i }).last();
    await confirmButton.waitFor({ state: 'visible' });
    await confirmButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async expectVaccinationInList(vaccine: string) {
    await expect(
      this.page.getByTestId('vaccination-card').filter({ hasText: vaccine }).first(),
    ).toBeVisible();
  }

  async expectVaccinationNotInList(vaccine: string) {
    await expect(
      this.page.getByTestId('vaccination-card').filter({ hasText: vaccine }),
    ).toHaveCount(0);
  }

  async expectEmptyState() {
    await expect(this.page.getByTestId('vaccinations-empty')).toBeVisible();
  }

  async expectDueSoonStrip(vaccine: string) {
    await expect(
      this.page.getByTestId('vaccinations-due-soon').filter({ hasText: vaccine }),
    ).toBeVisible();
  }
}
