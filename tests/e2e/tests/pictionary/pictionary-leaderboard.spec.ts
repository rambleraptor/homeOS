/**
 * Pictionary Leaderboard E2E tests.
 *
 * Seeds games via aepbase REST and verifies that the leaderboard route
 * ranks players by wins.
 */

import { test, expect } from '../../fixtures/aepbase.fixture';
import { PictionaryPage } from '../../pages/PictionaryPage';
import {
  createPerson,
  createPictionaryGame,
  deleteAllPictionaryGames,
  deleteAllPersonSharedData,
  deleteAllPeople,
} from '../../utils/aepbase-helpers';

test.describe('Pictionary Leaderboard', () => {
  let pictionaryPage: PictionaryPage;

  test.beforeEach(async ({ authenticatedPage, userToken }) => {
    pictionaryPage = new PictionaryPage(authenticatedPage);
    await deleteAllPictionaryGames(userToken);
    await deleteAllPersonSharedData(userToken);
    await deleteAllPeople(userToken);
  });

  test('shows the empty state when no games have been played', async () => {
    await pictionaryPage.gotoLeaderboard();
    await pictionaryPage.expectToBeOnLeaderboardPage();
    await pictionaryPage.expectLeaderboardEmpty();
  });

  test('ranks players by wins across multiple games', async ({
    userToken,
  }) => {
    const alice = await createPerson(userToken, { name: 'Alice Lead' });
    const bob = await createPerson(userToken, { name: 'Bob Lead' });
    const carol = await createPerson(userToken, { name: 'Carol Lead' });

    // Game 1: Alice wins, Bob loses.
    await createPictionaryGame(userToken, {
      location: 'Game 1',
      teams: [
        { players: [`people/${alice.id}`], won: true },
        { players: [`people/${bob.id}`], won: false },
      ],
    });

    // Game 2: Alice wins again, Carol loses.
    await createPictionaryGame(userToken, {
      location: 'Game 2',
      teams: [
        { players: [`people/${alice.id}`], won: true },
        { players: [`people/${carol.id}`], won: false },
      ],
    });

    // Game 3: Bob wins, Carol loses.
    await createPictionaryGame(userToken, {
      location: 'Game 3',
      teams: [
        { players: [`people/${bob.id}`], won: true },
        { players: [`people/${carol.id}`], won: false },
      ],
    });

    await pictionaryPage.goto();
    await pictionaryPage.clickLeaderboard();
    await pictionaryPage.expectToBeOnLeaderboardPage();

    const aliceRow = pictionaryPage.leaderboardRow(alice.id);
    const bobRow = pictionaryPage.leaderboardRow(bob.id);
    const carolRow = pictionaryPage.leaderboardRow(carol.id);

    await expect(aliceRow).toBeVisible();
    await expect(bobRow).toBeVisible();
    await expect(carolRow).toBeVisible();

    await expect(aliceRow).toContainText('Alice Lead');
    await expect(
      aliceRow.getByTestId(`pictionary-leaderboard-wins-${alice.id}`),
    ).toHaveText('2');
    await expect(
      bobRow.getByTestId(`pictionary-leaderboard-wins-${bob.id}`),
    ).toHaveText('1');
    await expect(
      carolRow.getByTestId(`pictionary-leaderboard-wins-${carol.id}`),
    ).toHaveText('0');
  });
});
