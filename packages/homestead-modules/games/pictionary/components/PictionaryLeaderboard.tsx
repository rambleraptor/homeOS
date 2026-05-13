'use client';

/**
 * Pictionary leaderboard — ranks players across every recorded game by
 * total wins, with games played and win rate as tiebreakers. Top rank
 * gets the trophy/amber treatment used elsewhere for winners.
 */

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, AlertCircle, Trophy, Pencil } from 'lucide-react';
import { PageHeader } from '@rambleraptor/homestead-core/shared/components/PageHeader';
import { usePeople } from '../../../people/hooks/usePeople';
import { usePlayerStats, type PlayerStats } from '../hooks/usePlayerStats';

interface PersonLite {
  id: string;
  name: string;
}

function displayNameFor(playerPath: string, people: PersonLite[]): string {
  const id = playerPath.replace(/^people\//, '');
  return people.find((p) => p.id === id)?.name || 'Unknown player';
}

function formatWinRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/**
 * Standard competition ranking ("1224"): players tied on the sort key
 * share a rank, and the next distinct entry skips ahead.
 */
function rankOf(index: number, stats: PlayerStats[]): number {
  if (index === 0) return 1;
  const prev = stats[index - 1];
  const curr = stats[index];
  const sameAsPrev =
    prev.wins === curr.wins &&
    prev.winRate === curr.winRate &&
    prev.gamesPlayed === curr.gamesPlayed;
  return sameAsPrev ? rankOf(index - 1, stats) : index + 1;
}

export function PictionaryLeaderboard() {
  const router = useRouter();
  const { data: stats, isLoading, isError } = usePlayerStats();
  const { data: people } = usePeople();

  const peopleLite = useMemo<PersonLite[]>(
    () => (people ?? []).map((p) => ({ id: p.id, name: p.name })),
    [people],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push('/games/pictionary')}
          aria-label="Back to Pictionary"
          data-testid="pictionary-leaderboard-back"
          className="p-2 rounded-md hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <PageHeader
            title="Pictionary Leaderboard"
            subtitle="Wins across every recorded game."
          />
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-accent-terracotta animate-spin" />
        </div>
      )}

      {isError && (
        <div className="bg-red-50/20 border border-red-200 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900">
                Failed to load Pictionary leaderboard
              </h3>
            </div>
          </div>
        </div>
      )}

      {!isLoading && !isError && stats.length === 0 && (
        <div
          className="bg-white rounded-lg shadow-md p-8 border border-gray-200 text-center"
          data-testid="pictionary-leaderboard-empty"
        >
          <Pencil className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">
            No Pictionary games yet. Record a game to start the leaderboard.
          </p>
        </div>
      )}

      {!isLoading && !isError && stats.length > 0 && (
        <ul className="space-y-2" data-testid="pictionary-leaderboard">
          {stats.map((row, index) => {
            const rank = rankOf(index, stats);
            const isTop = rank === 1;
            const playerId = row.playerPath.replace(/^people\//, '');
            return (
              <li key={row.playerPath}>
                <div
                  data-testid={`pictionary-leaderboard-row-${playerId}`}
                  className={`flex items-center gap-4 rounded-lg shadow-sm p-4 border ${
                    isTop
                      ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300 ring-1 ring-amber-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      isTop
                        ? 'bg-amber-200 text-amber-800'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                    aria-label={`Rank ${rank}`}
                  >
                    {isTop ? (
                      <Trophy className="w-5 h-5 text-amber-600" />
                    ) : (
                      rank
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">
                      {displayNameFor(row.playerPath, peopleLite)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {row.gamesPlayed}{' '}
                      {row.gamesPlayed === 1 ? 'game' : 'games'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="text-2xl font-bold text-gray-900"
                      data-testid={`pictionary-leaderboard-wins-${playerId}`}
                    >
                      {row.wins}
                    </div>
                    <div
                      className="text-xs uppercase tracking-wide text-gray-500"
                      data-testid={`pictionary-leaderboard-rate-${playerId}`}
                    >
                      {row.wins === 1 ? 'win' : 'wins'} ·{' '}
                      {formatWinRate(row.winRate)}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
