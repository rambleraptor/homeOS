'use client';

/**
 * Pictionary games list. Each row shows the game's date, location, and
 * winning word. Tapping opens the detail view.
 */

import React from 'react';
import { Pencil, Trophy } from 'lucide-react';
import type { PictionaryGame } from '../types';

interface PersonLite {
  id: string;
  name: string;
}

interface GameListProps {
  games: PictionaryGame[];
  /** Reserved for richer rows later (e.g. player names from team rosters). */
  people?: PersonLite[];
  onOpen: (game: PictionaryGame) => void;
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function GameList({ games, onOpen }: GameListProps) {
  if (games.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 border border-gray-200 text-center">
        <Pencil className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">
          No Pictionary games yet. Tap <strong>New Game</strong> to record one.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3" data-testid="pictionary-game-list">
      {games.map((game) => {
        const date = formatDate(game.played_at || game.create_time);
        return (
          <li key={game.id}>
            <button
              type="button"
              onClick={() => onOpen(game)}
              data-testid={`pictionary-game-item-${game.id}`}
              className="w-full text-left bg-white rounded-lg shadow-md p-4 border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-4"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-accent-terracotta/10 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-gray-900 truncate">
                    {game.location || 'Pictionary'}
                  </span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {date}
                  </span>
                </div>
                {game.winning_word && (
                  <div className="text-sm text-gray-600 truncate">
                    Winning word:{' '}
                    <span className="font-medium text-gray-800">
                      {game.winning_word}
                    </span>
                  </div>
                )}
                {game.notes && (
                  <div className="text-xs text-gray-500 mt-0.5 truncate">
                    {game.notes}
                  </div>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
