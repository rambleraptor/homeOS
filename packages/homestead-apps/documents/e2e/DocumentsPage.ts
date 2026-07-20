/**
 * Documents Page Object Model.
 *
 * Covers the two screens: the index (upload dropzone + one row per document,
 * showing just name + type) and a document's detail page (its parsed fields,
 * full text, and the edit form). A row is located by its title, since that's
 * what a user reads; fields and status are asserted on `data-testid`s.
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

  // --- Index rows -----------------------------------------------------------

  /** The row whose title matches, regardless of its position in the list. */
  card(title: string): Locator {
    return this.page
      .getByTestId('document-card')
      .filter({ has: this.page.getByTestId('document-title').filter({ hasText: title }) });
  }

  /** The single row, when a test has created exactly one document. */
  onlyCard(): Locator {
    return this.page.getByTestId('document-card');
  }

  status(title: string): Locator {
    return this.card(title).getByTestId('document-status');
  }

  type(title: string): Locator {
    return this.card(title).getByTestId('document-type');
  }

  /** The matched type's icon, shown on the row once a document is parsed. */
  typeIcon(title: string): Locator {
    return this.card(title).getByTestId('document-type-icon');
  }

  /** Open a document's detail page by clicking its row. */
  async open(title: string): Promise<void> {
    await this.card(title).click();
  }

  async expectEmpty(): Promise<void> {
    await expect(this.page.getByTestId('documents-empty')).toBeVisible();
  }

  // --- Detail page ----------------------------------------------------------

  detail(): Locator {
    return this.page.getByTestId('document-detail');
  }

  detailType(): Locator {
    return this.detail().getByTestId('document-type');
  }

  detailStatus(): Locator {
    return this.detail().getByTestId('document-status');
  }

  /** A parsed metadata field, rendered from the doc type's declaration. */
  detailField(fieldName: string): Locator {
    return this.detail().getByTestId(`document-field-${fieldName}`);
  }

  async edit(): Promise<void> {
    await this.detail().getByTestId('document-edit').click();
  }

  async setTitle(title: string): Promise<void> {
    await this.page.getByTestId('document-edit-title').fill(title);
  }

  editField(fieldName: string): Locator {
    return this.page.getByTestId(`document-edit-field-${fieldName}`).locator('input');
  }

  async save(): Promise<void> {
    await this.page.getByTestId('document-edit-save').click();
  }
}
