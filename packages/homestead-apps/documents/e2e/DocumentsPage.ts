/**
 * Documents Page Object Model.
 *
 * Encapsulates the documents home: the upload dropzone and the document cards.
 * A card is located by its title, since that's what a user reads; its status
 * and type are asserted on `data-testid`s.
 */

import { Page, Locator, expect } from '@playwright/test';

export class DocumentsPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/documents');
  }

  /** Upload a file via the real (hidden) input the dropzone button drives. */
  async uploadFile(name: string, mimeType: string, contents: string): Promise<void> {
    await this.page
      .getByTestId('document-file-input')
      .setInputFiles({ name, mimeType, buffer: Buffer.from(contents) });
  }

  /** The card whose title matches, regardless of its position in the list. */
  card(title: string): Locator {
    return this.page
      .getByTestId('document-card')
      .filter({ has: this.page.getByTestId('document-title').filter({ hasText: title }) });
  }

  status(title: string): Locator {
    return this.card(title).getByTestId('document-status');
  }

  type(title: string): Locator {
    return this.card(title).getByTestId('document-type');
  }

  field(title: string, fieldName: string): Locator {
    return this.card(title).getByTestId(`document-field-${fieldName}`);
  }

  async expectEmpty(): Promise<void> {
    await expect(this.page.getByTestId('documents-empty')).toBeVisible();
  }
}
