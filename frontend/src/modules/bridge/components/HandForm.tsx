'use client';

/**
 * Quick-entry hand form. Three button rows at the top: level (1-7), suit
 * (clubs/diamonds/hearts/spades/no-trump), and direction (N/E/S/W).
 *
 * Flow: pick a level + suit, then tap a direction to commit that bid for
 * the direction. Direction buttons disable once used, so a direction
 * can't repeat until the next hand. When the fourth direction is tapped
 * all four bids are submitted and the form resets for the next hand.
 */

import React, { useState } from 'react';
import type {
  BridgeDirection,
  BridgeLevel,
  BridgeSuit,
  HandFormData,
} from '../types';
import {
  BRIDGE_DIRECTIONS,
  BRIDGE_LEVELS,
  BRIDGE_SUITS,
} from '../types';
import { DIRECTION_SHORT, SUIT_SYMBOL, SUIT_LABEL, formatBid } from '../utils';

interface HandFormProps {
  onSubmit: (data: HandFormData) => void;
  isSubmitting?: boolean;
}

interface DirBid {
  level: BridgeLevel;
  suit: BridgeSuit;
}

const DIRECTION_ORDER: BridgeDirection[] = ['north', 'east', 'south', 'west'];

function toFormData(entered: Record<BridgeDirection, DirBid>): HandFormData {
  return {
    north_level: entered.north.level,
    north_suit: entered.north.suit,
    east_level: entered.east.level,
    east_suit: entered.east.suit,
    south_level: entered.south.level,
    south_suit: entered.south.suit,
    west_level: entered.west.level,
    west_suit: entered.west.suit,
  };
}

export function HandForm({ onSubmit, isSubmitting }: HandFormProps) {
  const [level, setLevel] = useState<BridgeLevel>(1);
  const [suit, setSuit] = useState<BridgeSuit>('clubs');
  const [entered, setEntered] = useState<Partial<Record<BridgeDirection, DirBid>>>({});

  const handleDirection = (dir: BridgeDirection) => {
    if (entered[dir] || isSubmitting) return;
    const next = { ...entered, [dir]: { level, suit } };
    const complete = BRIDGE_DIRECTIONS.every((d) => next[d]);
    if (complete) {
      onSubmit(toFormData(next as Record<BridgeDirection, DirBid>));
      setEntered({});
      setLevel(1);
      setSuit('clubs');
      return;
    }
    setEntered(next);
  };

  return (
    <section
      data-testid="hand-form"
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4"
    >
      <div className="space-y-2">
        <div className="text-xs font-medium text-gray-600">Level</div>
        <div
          role="radiogroup"
          aria-label="Level"
          className="grid grid-cols-7 gap-1"
        >
          {BRIDGE_LEVELS.map((lvl) => {
            const active = lvl === level;
            return (
              <button
                key={lvl}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setLevel(lvl)}
                data-testid={`level-${lvl}`}
                className={`h-12 rounded-md text-base font-semibold border transition-colors ${
                  active
                    ? 'bg-accent-terracotta border-accent-terracotta text-white'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {lvl}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-gray-600">Suit</div>
        <div
          role="radiogroup"
          aria-label="Suit"
          className="grid grid-cols-5 gap-1"
        >
          {BRIDGE_SUITS.map((s) => {
            const active = s === suit;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={SUIT_LABEL[s]}
                onClick={() => setSuit(s)}
                data-testid={`suit-${s}`}
                className={`h-12 rounded-md text-lg font-semibold border transition-colors ${
                  active
                    ? 'bg-accent-terracotta border-accent-terracotta text-white'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {SUIT_SYMBOL[s]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-gray-600">Direction</div>
        <div className="grid grid-cols-4 gap-1">
          {DIRECTION_ORDER.map((dir) => {
            const bid = entered[dir];
            const done = Boolean(bid);
            return (
              <button
                key={dir}
                type="button"
                disabled={done || isSubmitting}
                onClick={() => handleDirection(dir)}
                data-testid={`direction-${dir}`}
                className={`h-14 rounded-md text-base font-semibold border transition-colors flex flex-col items-center justify-center gap-0.5 ${
                  done
                    ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-accent-terracotta border-accent-terracotta text-white hover:bg-accent-terracotta-hover disabled:opacity-40'
                }`}
              >
                <span>{DIRECTION_SHORT[dir]}</span>
                {bid && (
                  <span
                    className="text-xs font-normal"
                    data-testid={`direction-${dir}-bid`}
                  >
                    {formatBid(bid.level, bid.suit)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
