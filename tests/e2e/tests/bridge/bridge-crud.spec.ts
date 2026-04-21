/**
 * Bridge E2E Tests — drives the quick-entry UI end-to-end. Bridge
 * persists hands in localStorage, so the POM clears it before each
 * navigation.
 */

import { test } from '../../fixtures/aepbase.fixture';
import { BridgePage } from '../../pages/BridgePage';

test.describe('Bridge CRUD', () => {
  let bridgePage: BridgePage;

  test.beforeEach(async ({ authenticatedPage }) => {
    bridgePage = new BridgePage(authenticatedPage);
  });

  test('enters a hand through the UI and shows every direction on the list', async () => {
    await bridgePage.goto();
    await bridgePage.expectToBeOnBridgePage();

    await bridgePage.enterHand({
      north: { level: 3, suit: 'spades' },
      east: { level: 4, suit: 'no-trump' },
      south: { level: 2, suit: 'hearts' },
      west: { level: 7, suit: 'diamonds' },
    });

    await bridgePage.expectHandInList();
    await bridgePage.expectCardCount(1);
    await bridgePage.expectFirstCardBid('north', '3♠');
    await bridgePage.expectFirstCardBid('east', '4 NT');
    await bridgePage.expectFirstCardBid('south', '2♥');
    await bridgePage.expectFirstCardBid('west', '7♦');
  });

  test('lists multiple hands newest-first', async () => {
    await bridgePage.goto();

    await bridgePage.enterHand({
      north: { level: 1, suit: 'clubs' },
      east: { level: 1, suit: 'clubs' },
      south: { level: 1, suit: 'clubs' },
      west: { level: 1, suit: 'clubs' },
    });

    await bridgePage.enterHand({
      north: { level: 5, suit: 'hearts' },
      east: { level: 6, suit: 'spades' },
      south: { level: 7, suit: 'no-trump' },
      west: { level: 2, suit: 'diamonds' },
    });

    await bridgePage.expectCardCount(2);
    await bridgePage.expectFirstCardBid('north', '5♥');
    await bridgePage.expectFirstCardBid('south', '7 NT');
  });
});
