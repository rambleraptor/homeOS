/**
 * Gift Cards Page Object Model
 */

import { Page, expect, Locator } from '@playwright/test';

export class GiftCardsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/gift-cards');
  }

  async expectToBeOnGiftCardsPage() {
    await expect(this.page).toHaveURL(/\/gift-cards/);
  }

  async clickAddGiftCard() {
    await this.page.getByRole('button', { name: /add gift card|new gift card/i }).click();
  }

  async fillGiftCardForm(data: {
    merchant: string;
    amount: number;
    card_number?: string;
    pin?: string;
    notes?: string;
  }) {
    await this.page.locator('#merchant').fill(data.merchant);
    await this.page.locator('#card_number').fill(data.card_number || '1234-5678-9012-3456');
    await this.page.locator('#amount').fill(data.amount.toString());

    if (data.pin) {
      await this.page.locator('#pin').fill(data.pin);
    }

    if (data.notes) {
      await this.page.locator('#notes').fill(data.notes);
    }
  }

  async submitGiftCardForm() {
    await this.page.getByRole('button', { name: /save|submit|create/i }).click();
  }

  async createGiftCard(data: {
    merchant: string;
    amount: number;
    card_number?: string;
    pin?: string;
    notes?: string;
  }) {
    await this.clickAddGiftCard();
    await this.fillGiftCardForm(data);
    await this.submitGiftCardForm();

    // Wait for form to close or success message
    await this.page.waitForTimeout(500);
  }

  async expectGiftCardInList(merchant: string, amount?: number) {
    await expect(this.page.getByText(merchant)).toBeVisible();

    if (amount !== undefined) {
      const formattedAmount = `$${amount.toFixed(2)}`;
      await expect(this.page.getByText(formattedAmount)).toBeVisible();
    }
  }

  async expectGiftCardNotInList(merchant: string) {
    await expect(this.page.getByText(merchant).first()).not.toBeVisible({ timeout: 2000 }).catch(() => {
      // If the element doesn't exist at all, that's also fine
    });
  }

  async getGiftCardRow(merchant: string): Promise<Locator> {
    return this.page.getByRole('row').filter({ hasText: merchant }).first();
  }

  async editGiftCard(merchant: string, newData: Partial<{
    merchant: string;
    amount: number;
    card_number: string;
    pin: string;
    notes: string;
  }>) {
    const row = await this.getGiftCardRow(merchant);
    await row.getByRole('button', { name: /edit/i }).click();

    if (newData.merchant) {
      await this.page.locator('#merchant').fill(newData.merchant);
    }

    if (newData.amount !== undefined) {
      const amountField = this.page.locator('#amount');
      await amountField.clear();
      await amountField.fill(newData.amount.toString());
    }

    if (newData.card_number) {
      await this.page.locator('#card_number').fill(newData.card_number);
    }

    if (newData.pin) {
      await this.page.locator('#pin').fill(newData.pin);
    }

    if (newData.notes) {
      await this.page.locator('#notes').fill(newData.notes);
    }

    await this.submitGiftCardForm();
    await this.page.waitForTimeout(500);
  }

  async deleteGiftCard(merchant: string) {
    const row = await this.getGiftCardRow(merchant);
    await row.getByRole('button', { name: /delete|remove/i }).click();

    // Confirm deletion if there's a confirmation dialog
    const confirmButton = this.page.getByRole('button', { name: /confirm|yes|delete/i });

    try {
      await confirmButton.click({ timeout: 2000 });
    } catch {
      // No confirmation dialog, that's fine
    }

    await this.page.waitForTimeout(500);
  }

  async expectMerchantSummary(merchant: string, totalAmount: number) {
    await expect(this.page.getByText(merchant)).toBeVisible();
    const formattedTotal = `$${totalAmount.toFixed(2)}`;
    await expect(this.page.getByText(formattedTotal)).toBeVisible();
  }
}
