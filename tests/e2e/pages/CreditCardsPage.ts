/**
 * Page Object for the Credit Cards app.
 *
 * Encapsulates the card → perk → redemption nested flow. Perks and
 * redemptions are aepbase children of a credit-card, so exercising this UI
 * drives the generic offline mutation factory's convention-based nesting
 * (create/update/delete/redeem across two levels of parent).
 */

import { Page, Locator, expect } from '@playwright/test';

export class CreditCardsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/credit-cards');
    await expect(
      this.page.getByRole('heading', { name: 'Credit Cards' }),
    ).toBeVisible();
  }

  // ---- cards --------------------------------------------------------------

  cardRow(name: string): Locator {
    return this.page
      .locator('[data-testid^="card-row-"]')
      .filter({ hasText: name });
  }

  async addCard(opts: {
    name: string;
    issuer: string;
    annualFee: number;
    anniversary: string; // yyyy-mm-dd
  }): Promise<void> {
    await this.page.getByTestId('add-credit-card-button').click();
    await expect(this.page.getByTestId('credit-card-form')).toBeVisible();
    await this.page.locator('#card-name').fill(opts.name);
    await this.page.locator('#card-issuer').fill(opts.issuer);
    await this.page.locator('#card-annual-fee').fill(String(opts.annualFee));
    await this.page.locator('#card-anniversary').fill(opts.anniversary);
    await this.page.getByTestId('credit-card-form-submit').click();
    await expect(this.cardRow(opts.name)).toBeVisible();
  }

  async openCard(name: string): Promise<void> {
    await this.cardRow(name).click();
    await expect(this.page.getByTestId('add-perk-button')).toBeVisible();
  }

  // ---- perks (nested under a card) ---------------------------------------

  perkRow(name: string): Locator {
    return this.page
      .locator('[data-testid^="perk-row-"]')
      .filter({ hasText: name });
  }

  async addPerk(opts: {
    name: string;
    value: number;
    frequency?: 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  }): Promise<void> {
    await this.page.getByTestId('add-perk-button').click();
    await expect(this.page.getByTestId('perk-form')).toBeVisible();
    await this.page.locator('#perk-name').fill(opts.name);
    await this.page.locator('#perk-value').fill(String(opts.value));
    if (opts.frequency) {
      await this.page.locator('#perk-frequency').selectOption(opts.frequency);
    }
    await this.page.getByTestId('perk-form-submit').click();
    await expect(this.perkRow(opts.name)).toBeVisible();
  }

  async editPerkValue(name: string, newValue: number): Promise<void> {
    await this.perkRow(name)
      .locator('[data-testid^="edit-perk-"]')
      .click();
    await expect(this.page.getByTestId('perk-form')).toBeVisible();
    await this.page.locator('#perk-value').fill(String(newValue));
    await this.page.getByTestId('perk-form-submit').click();
    await expect(this.page.getByTestId('perk-form')).toBeHidden();
  }

  async redeemPerk(name: string): Promise<void> {
    await this.perkRow(name)
      .locator('[data-testid^="redeem-perk-"]')
      .click();
  }

  async deletePerk(name: string): Promise<void> {
    await this.perkRow(name)
      .locator('[data-testid^="delete-perk-"]')
      .click();
    await this.page.getByRole('button', { name: 'Delete', exact: true }).click();
  }

  /** The perk row's derived redemption status: 'none' | 'partial' | 'full'. */
  async perkRedemptionStatus(name: string): Promise<string | null> {
    return this.perkRow(name).getAttribute('data-redemption-status');
  }
}
