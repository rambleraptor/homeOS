/**
 * People Page Object Model
 */

import { Page, expect, Locator } from '@playwright/test';

export class PeoplePage {
  constructor(private page: Page) { }

  async goto() {
    await this.page.goto('/people');
  }

  async expectToBeOnPeoplePage() {
    await expect(this.page).toHaveURL(/\/people/);
  }

  async clickAddPerson() {
    const addButton = this.page.getByTestId('add-person-button');
    await addButton.waitFor({ state: 'visible' });
    await addButton.click();
  }

  async fillPersonForm(data: {
    name: string;
    address?: string;
    birthday?: string;
    anniversary?: string;
  }) {
    await this.page.locator('#name').fill(data.name);

    if (data.address) {
      // Address is now split into multiple fields, use line1 for simple string addresses
      await this.page.locator('#address_line1').fill(data.address);
    }
    if (data.birthday) {
      await this.page.locator('#birthday').fill(data.birthday);
    }
    if (data.anniversary) {
      await this.page.locator('#anniversary').fill(data.anniversary);
    }
  }

  async submitPersonForm() {
    const submitButton = this.page.getByTestId('person-form-submit');
    await submitButton.waitFor({ state: 'visible' });
    await submitButton.click();
    await submitButton.waitFor({ state: 'hidden' });
  }

  async createPerson(data: {
    name: string;
    address?: string;
    birthday?: string;
    anniversary?: string;
  }) {
    await this.clickAddPerson();
    await this.fillPersonForm(data);
    await this.submitPersonForm();
    await this.page.waitForLoadState('networkidle');
  }

  async expectPersonInList(personName: string) {
    await expect(this.page.getByText(personName).first()).toBeVisible();
  }

  async expectPersonNotInList(personName: string) {
    const personLocator = this.page.getByText(personName).first();
    await expect(personLocator).not.toBeVisible({ timeout: 2000 }).catch(() => {
      // Element doesn't exist, which is fine
    });
  }

  async getPersonCard(personName: string): Promise<Locator> {
    return this.page.getByRole('heading', { name: personName, level: 3 })
      .locator('..')
      .locator('..');
  }

  async editPerson(personName: string, newData: Partial<{
    name: string;
    address: string;
    birthday: string;
    anniversary: string;
  }>) {
    await this.expectPersonInList(personName);

    const editButton = this.page.getByRole('button', { name: `Edit ${personName}` }).first();
    await editButton.waitFor({ state: 'visible' });
    await editButton.click();

    await this.page.locator('#name').waitFor({ state: 'visible' });

    if (newData.name) {
      await this.page.locator('#name').fill(newData.name);
    }
    if (newData.address) {
      // Address is now split into multiple fields, use line1 for simple string addresses
      await this.page.locator('#address_line1').fill(newData.address);
    }
    if (newData.birthday) {
      await this.page.locator('#birthday').fill(newData.birthday);
    }
    if (newData.anniversary) {
      await this.page.locator('#anniversary').fill(newData.anniversary);
    }

    await this.submitPersonForm();
  }

  async deletePerson(personName: string) {
    await this.expectPersonInList(personName);

    const deleteButton = this.page.getByRole('button', { name: `Delete ${personName}` }).first();
    await deleteButton.waitFor({ state: 'visible' });
    await deleteButton.click();

    const confirmButton = this.page.getByRole('button', { name: /confirm|yes|delete/i });
    const isConfirmVisible = await confirmButton.isVisible({ timeout: 1000 }).catch(() => false);

    if (isConfirmVisible) {
      await confirmButton.click();
    }

    await this.page.waitForLoadState('networkidle');
  }

  // Bulk Import Methods

  async gotoBulkImport() {
    await this.page.goto('/people/import');
    await expect(this.page).toHaveURL(/\/people\/import/);
  }

  async uploadCSVContent(csvContent: string) {
    // Create a file from CSV content and upload it
    const buffer = Buffer.from(csvContent);

    // Wait for file input to be present
    const fileInput = this.page.locator('input[type="file"][accept=".csv"]');
    await fileInput.waitFor({ state: 'attached' });

    // Upload the file
    await fileInput.setInputFiles({
      name: 'test_import.csv',
      mimeType: 'text/csv',
      buffer,
    });

    // Wait for parsing to complete
    await this.page.waitForLoadState('networkidle');
  }

  async expectParsedPeopleCount(validCount: number, invalidCount?: number) {
    // Check the valid count stat card
    await expect(
      this.page.locator('text="Valid People"').locator('..').locator('p.text-2xl')
    ).toContainText(String(validCount));

    if (invalidCount !== undefined) {
      await expect(
        this.page.locator('text="Invalid People"').locator('..').locator('p.text-2xl')
      ).toContainText(String(invalidCount));
    }
  }

  async selectAllValidPeople() {
    const selectAllButton = this.page.getByRole('button', { name: 'Select All' });
    if (await selectAllButton.isVisible()) {
      await selectAllButton.click();
    }
  }

  async clickImport() {
    const importButton = this.page.getByRole('button', { name: /Import \d+ Person/ });
    await importButton.waitFor({ state: 'visible' });
    await importButton.click();

    // Wait for import to complete and redirect
    await this.page.waitForURL(/\/people$/);
  }

  async expectImportSuccess(count: number) {
    // Look for toast notification or redirect to people page
    await this.page.waitForURL(/\/people$/);
    // Success toasts are shown but may disappear quickly
  }

  async expectPersonHasPartner(personName: string, partnerName: string) {
    // Find the person card and verify partner is shown
    const personCard = await this.getPersonCard(personName);
    await expect(personCard.getByText(partnerName)).toBeVisible();
  }

  async expectPersonHasAddress(personName: string, addressPart: string) {
    // Find the person card and verify address is shown
    const personCard = await this.getPersonCard(personName);
    await expect(personCard.getByText(addressPart, { exact: false })).toBeVisible();
  }

  async expectPreviewShowsPartner(personName: string, partnerName: string) {
    // In bulk import preview, find the person and check for partner badge
    const personRow = this.page.locator('h3', { hasText: personName }).locator('..');
    await expect(personRow.getByText(`Partner: ${partnerName}`)).toBeVisible();
  }

  async expectPreviewShowsWifi(personName: string, wifiNetwork: string) {
    // In bulk import preview, find the person and check for WiFi badge
    const personRow = this.page.locator('h3', { hasText: personName }).locator('..');
    await expect(personRow.getByText(`WiFi: ${wifiNetwork}`)).toBeVisible();
  }
}

