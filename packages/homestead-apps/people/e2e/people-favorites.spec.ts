/**
 * People E2E — favorites (starring).
 *
 * Stars are stored as per-user `favorite` records (create on star, delete on
 * unstar). This proves the round-trip through the UI: the star button reflects
 * and persists state across a reload, exercising the new `favorite` resource
 * end-to-end (create + list + delete).
 */

import { test, expect } from '../../../../tests/e2e/fixtures/aepbase.fixture';
import { PeoplePage } from './PeoplePage';
import { createPerson, deleteAllPeople } from './helpers';

test.describe('People favorites', () => {
  let peoplePage: PeoplePage;

  test.beforeEach(async ({ authenticatedPage, userToken }) => {
    peoplePage = new PeoplePage(authenticatedPage);
    await deleteAllPeople(userToken);
  });

  test('stars a person and the star persists across a reload', async ({
    authenticatedPage,
    userToken,
    userId,
  }) => {
    const person = await createPerson(userToken, {
      name: 'Star Target',
      createdByUserId: userId,
    });
    await peoplePage.goto();

    const star = authenticatedPage.getByTestId(`person-star-${person.id}`);
    await expect(star).toHaveAttribute('aria-pressed', 'false');

    await star.click();
    await expect(star).toHaveAttribute('aria-pressed', 'true');

    // Reload: the star state comes back from the persisted favorite record.
    await authenticatedPage.reload();
    const starAfter = authenticatedPage.getByTestId(`person-star-${person.id}`);
    await expect(starAfter).toHaveAttribute('aria-pressed', 'true');

    // Unstar removes the favorite record.
    await starAfter.click();
    await expect(starAfter).toHaveAttribute('aria-pressed', 'false');

    await authenticatedPage.reload();
    await expect(
      authenticatedPage.getByTestId(`person-star-${person.id}`),
    ).toHaveAttribute('aria-pressed', 'false');
  });
});
