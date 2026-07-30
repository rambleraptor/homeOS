/**
 * Bridge Page Object Model
 *
 * The bridge home page shows a quick-entry form above the list of saved
 * hands. Entry is three button taps per direction: level (1-7), suit,
 * then the direction itself, which commits the bid. Once all four
 * directions are entered the hand auto-saves. Bridge data is persisted
 * in `localStorage` (key `bridge:hands`), so `goto()` clears it via an
 * init script to give every test a clean slate.
 */

import { Page, expect } from '@playwright/test';

type Direction = 'north' | 'south' | 'east' | 'west';
type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades' | 'no-trump' | 'pass';

const STORAGE_KEY = 'bridge:hands';

export class BridgePage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.addInitScript(
      (key) => window.localStorage.removeItem(key),
      STORAGE_KEY,
    );
    await this.page.goto('/games/bridge');
    await this.page.getByTestId('hand-form').waitFor({ state: 'visible' });
  }

  async expectToBeOnBridgePage() {
    await expect(this.page).toHaveURL(/\/games\/bridge/);
    await expect(
      this.page.getByRole('heading', { name: 'Bridge' }),
    ).toBeVisible();
  }

  /**
   * Enter a single direction's bid: level → suit → direction. For a
   * pass, omit level and pass `suit: 'pass'`.
   */
  async enterBid(direction: Direction, level: number | undefined, suit: Suit) {
    if (suit !== 'pass' && level !== undefined) {
      await this.page.getByTestId(`level-${level}`).click();
    }
    await this.page.getByTestId(`suit-${suit}`).click();
    await this.page.getByTestId(`direction-${direction}`).click();
  }

  /** Choose which board (1-36) subsequent hands are recorded on. */
  async selectBoard(board: number) {
    await this.page.getByTestId('board-select').selectOption(String(board));
  }

  /**
   * Enter all four directions in N/E/S/W order. The hand auto-saves
   * when the fourth direction is committed. Pass `board` to record the
   * hand on a specific board first.
   */
  async enterHand(
    bids: Record<Direction, { level?: number; suit: Suit }>,
    board?: number,
  ) {
    if (board !== undefined) {
      await this.selectBoard(board);
    }
    const order: Direction[] = ['north', 'east', 'south', 'west'];
    for (const dir of order) {
      await this.enterBid(dir, bids[dir].level, bids[dir].suit);
    }
  }

  async expectHandInList() {
    await expect(this.page.getByTestId('hand-list')).toBeVisible();
  }

  /**
   * Assert the bid in a given direction on the first hand card.
   * IDs are generated client-side, so we look the card up by position.
   */
  async expectFirstCardBid(direction: Direction, text: string) {
    const card = this.page
      .locator('[data-testid^="hand-card-"]')
      .first();
    await expect(
      card.locator(`[data-testid$="-${direction}-bid"]`),
    ).toHaveText(text);
  }

  /** Assert the board label shown on the first hand card. */
  async expectFirstCardBoard(text: string) {
    const card = this.page.locator('[data-testid^="hand-card-"]').first();
    await expect(card.locator('[data-testid$="-board"]')).toHaveText(text);
  }

  async expectCardCount(count: number) {
    await expect(this.page.locator('[data-testid^="hand-card-"]')).toHaveCount(
      count,
    );
  }
}
