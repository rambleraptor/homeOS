/**
 * Redaction E2E.
 *
 * The "Redact & upload" path rasterizes the file in the browser, lets the user
 * paint an opaque box over it, flattens the result, and hands that flattened
 * File to the same upload flow the plain button uses. This drives the real
 * canvas pipeline (jsdom can't) end to end: open a file, draw a box, confirm,
 * and see a document appear — proving the flattened file uploads through the
 * untouched flow.
 */

import { test, expect } from '../../../../tests/e2e/fixtures/aepbase.fixture';
import type { Page } from '@playwright/test';
import { DocumentsPage } from './DocumentsPage';
import { deleteAllDocuments, deleteAllOperations } from './helpers';

/** Make a real, decodable PNG in the browser so createImageBitmap can open it. */
async function makePng(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.fillStyle = '#3366cc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(20, 20, 60, 20); // a "sensitive" strip to cover
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return Buffer.from(base64, 'base64');
}

test.describe('Document redaction', () => {
  test.beforeEach(async ({ userToken }) => {
    await deleteAllDocuments(userToken);
    await deleteAllOperations(userToken);
  });

  test.afterEach(async ({ userToken }) => {
    await deleteAllDocuments(userToken);
    await deleteAllOperations(userToken);
  });

  test('redact & upload flattens a file client-side, then uploads it through the normal flow', async ({
    authenticatedPage,
  }) => {
    const documents = new DocumentsPage(authenticatedPage);
    await documents.goto();
    await documents.expectEmpty();

    const png = await makePng(authenticatedPage);
    await documents.pickRedactFile('secret.png', 'image/png', png);

    // Editor opens on the rasterized page.
    await expect(documents.redactionEditor()).toBeVisible();
    await expect(documents.redactionSurface()).toBeVisible();

    // Draw one redaction box; it renders as a committed rectangle.
    await documents.drawRedaction();
    await expect(documents.redactionRects()).toHaveCount(1);

    // Confirming flattens and uploads via the same mutation the plain path uses.
    await documents.confirmRedaction();
    await expect(documents.redactionEditor()).toBeHidden();

    // The flattened document lands in the list through the untouched upload flow.
    const card = documents.onlyCard();
    await expect(card).toBeVisible();
    await expect(card.getByTestId('document-title')).toContainText('secret');
  });

  test('cancelling the editor uploads nothing', async ({ authenticatedPage }) => {
    const documents = new DocumentsPage(authenticatedPage);
    await documents.goto();
    await documents.expectEmpty();

    const png = await makePng(authenticatedPage);
    await documents.pickRedactFile('secret.png', 'image/png', png);
    await expect(documents.redactionEditor()).toBeVisible();

    await authenticatedPage.getByTestId('redaction-cancel').click();
    await expect(documents.redactionEditor()).toBeHidden();
    await documents.expectEmpty();
  });
});
