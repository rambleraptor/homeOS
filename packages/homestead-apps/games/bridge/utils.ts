/**
 * Presentation helpers for the Bridge app — suit symbols/labels and a
 * compact bid formatter (e.g. `3♠`, `7 NT`).
 */

import type { BridgeDirection, BridgeSuit, Hand } from './types';

export const SUIT_SYMBOL: Record<BridgeSuit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
  'no-trump': 'NT',
  pass: 'Pass',
};

export const SUIT_LABEL: Record<BridgeSuit, string> = {
  clubs: 'Clubs',
  diamonds: 'Diamonds',
  hearts: 'Hearts',
  spades: 'Spades',
  'no-trump': 'No Trump',
  pass: 'Pass',
};

export const DIRECTION_LABEL: Record<BridgeDirection, string> = {
  north: 'North',
  south: 'South',
  east: 'East',
  west: 'West',
};

export const DIRECTION_SHORT: Record<BridgeDirection, string> = {
  north: 'N',
  south: 'S',
  east: 'E',
  west: 'W',
};

export function formatBid(level: number | undefined, suit: BridgeSuit): string {
  if (suit === 'pass') return 'Pass';
  const symbol = SUIT_SYMBOL[suit];
  return suit === 'no-trump' ? `${level} ${symbol}` : `${level}${symbol}`;
}

/**
 * A board filter value: a board number (1-36), or `null` for legacy
 * hands recorded before boards existed (no `board` column).
 */
export type BoardFilterValue = number | null;

/** The board a hand belongs to for filtering (`null` when unrecorded). */
export function handBoard(hand: Hand): BoardFilterValue {
  return hand.board ?? null;
}

/**
 * The distinct boards present across a set of hands, ascending, with the
 * "no board" bucket (legacy hands) sorted last.
 */
export function distinctBoards(hands: Hand[]): BoardFilterValue[] {
  const seen = new Set<BoardFilterValue>();
  for (const hand of hands) seen.add(handBoard(hand));
  return Array.from(seen).sort((a, b) => {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  });
}
