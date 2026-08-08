/**
 * Person Detail Page Object Model.
 *
 * Covers navigating to a person's detail page (directly or by clicking their
 * name in the list) and asserting the categorized documents shown there.
 */

import { Page, expect, Locator } from '@playwright/test';

export class PersonDetailPage {
  constructor(private page: Page) {}

  async goto(personId: string) {
    await this.page.goto(`/people/${personId}`);
    await this.page.getByTestId('person-detail').waitFor({ state: 'visible' });
  }

  /** Open the detail page by clicking a person's name link in the People list. */
  async openFromList(personName: string) {
    const link = this.page.getByTestId('person-detail-link').filter({ hasText: personName });
    await link.first().click();
    await this.page.getByTestId('person-detail').waitFor({ state: 'visible' });
  }

  async expectName(name: string) {
    await expect(
      this.page.getByRole('heading', { level: 1, name }),
    ).toBeVisible();
  }

  private group(category: 'tax' | 'medical' | 'other'): Locator {
    return this.page.getByTestId(`person-documents-group-${category}`);
  }

  /** A document with `title` appears under the given category section. */
  async expectDocumentInCategory(
    category: 'tax' | 'medical' | 'other',
    title: string,
  ) {
    const card = this.group(category).getByTestId('document-card').filter({ hasText: title });
    await expect(card).toBeVisible();
  }

  async expectNoDocuments() {
    await expect(this.page.getByTestId('person-documents-empty')).toBeVisible();
  }
}
