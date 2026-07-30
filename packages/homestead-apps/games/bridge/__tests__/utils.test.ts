import { describe, it, expect } from 'vitest';
import {
  formatBid,
  SUIT_SYMBOL,
  DIRECTION_SHORT,
  distinctBoards,
  handBoard,
} from '../utils';
import type { Hand } from '../types';

function makeHand(id: string, board?: number): Hand {
  return {
    id,
    path: `hands/${id}`,
    board,
    create_time: '2026-04-20T12:00:00Z',
    update_time: '2026-04-20T12:00:00Z',
    north_suit: 'pass',
    south_suit: 'pass',
    east_suit: 'pass',
    west_suit: 'pass',
  };
}

describe('bridge/utils', () => {
  it('formats suited bids with the suit symbol glued to the level', () => {
    expect(formatBid(3, 'spades')).toBe('3♠');
    expect(formatBid(7, 'clubs')).toBe('7♣');
    expect(formatBid(1, 'diamonds')).toBe('1♦');
    expect(formatBid(5, 'hearts')).toBe('5♥');
  });

  it('spaces no-trump bids so "NT" reads clearly', () => {
    expect(formatBid(4, 'no-trump')).toBe('4 NT');
  });

  it('exposes short labels for each direction', () => {
    expect(DIRECTION_SHORT.north).toBe('N');
    expect(DIRECTION_SHORT.south).toBe('S');
    expect(DIRECTION_SHORT.east).toBe('E');
    expect(DIRECTION_SHORT.west).toBe('W');
  });

  it('uses NT for no-trump in the symbol map', () => {
    expect(SUIT_SYMBOL['no-trump']).toBe('NT');
  });

  it('formats a pass bid as "Pass" regardless of level', () => {
    expect(formatBid(undefined, 'pass')).toBe('Pass');
    expect(formatBid(3, 'pass')).toBe('Pass');
  });

  it('reads a hand\'s board, treating a missing board as null', () => {
    expect(handBoard(makeHand('a', 5))).toBe(5);
    expect(handBoard(makeHand('b'))).toBeNull();
  });

  it('lists distinct boards ascending, deduped', () => {
    const hands = [
      makeHand('a', 9),
      makeHand('b', 3),
      makeHand('c', 9),
      makeHand('d', 1),
    ];
    expect(distinctBoards(hands)).toEqual([1, 3, 9]);
  });

  it('sorts the legacy "no board" bucket last', () => {
    const hands = [makeHand('a', 4), makeHand('b'), makeHand('c', 2)];
    expect(distinctBoards(hands)).toEqual([2, 4, null]);
  });

  it('returns an empty list when there are no hands', () => {
    expect(distinctBoards([])).toEqual([]);
  });
});
