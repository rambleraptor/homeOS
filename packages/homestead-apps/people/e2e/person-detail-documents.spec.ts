/**
 * Person detail page — categorized documents.
 *
 * Seeds people and documents through the client (per the e2e guidelines) and
 * checks that a person's detail page lists the documents linked to them, grouped
 * by category, and excludes documents linked to someone else.
 */

import { test } from '../../../../tests/e2e/fixtures/aepbase.fixture';
import { createPerson, deleteAllPeople } from './helpers';
import {
  createDocumentWithPeople,
  deleteAllDocuments,
} from '../../documents/e2e/helpers';
import { PersonDetailPage } from './PersonDetailPage';

test.describe('Person detail — documents', () => {
  let detail: PersonDetailPage;

  test.beforeEach(async ({ authenticatedPage, userToken }) => {
    detail = new PersonDetailPage(authenticatedPage);
    await deleteAllDocuments(userToken);
    await deleteAllPeople(userToken);
  });

  test('lists a person’s documents grouped by category', async ({
    authenticatedPage,
    userToken,
  }) => {
    const alice = await createPerson(userToken, { name: 'Alice Rivera' });
    const bob = await createPerson(userToken, { name: 'Bob Stone' });

    await createDocumentWithPeople(userToken, {
      title: 'Alice W-2',
      docType: 'form-w2', // category: tax
      people: [alice.id],
    });
    await createDocumentWithPeople(userToken, {
      title: 'Alice Pharmacy Receipt',
      docType: 'medical-receipt', // category: medical
      people: [alice.id],
    });
    // Linked to Bob only — must not appear on Alice's page.
    await createDocumentWithPeople(userToken, {
      title: 'Bob W-2',
      docType: 'form-w2',
      people: [bob.id],
    });

    await authenticatedPage.goto('/people');
    await detail.openFromList('Alice Rivera');

    await detail.expectName('Alice Rivera');
    await detail.expectDocumentInCategory('tax', 'Alice W-2');
    await detail.expectDocumentInCategory('medical', 'Alice Pharmacy Receipt');

    // Bob's document is absent from Alice's page.
    const bobDoc = authenticatedPage.getByTestId('document-card').filter({ hasText: 'Bob W-2' });
    await test.expect(bobDoc).toHaveCount(0);
  });

  test('shows an empty state when a person has no documents', async ({ userToken }) => {
    const carol = await createPerson(userToken, { name: 'Carol Diaz' });
    await detail.goto(carol.id);
    await detail.expectName('Carol Diaz');
    await detail.expectNoDocuments();
  });
});
