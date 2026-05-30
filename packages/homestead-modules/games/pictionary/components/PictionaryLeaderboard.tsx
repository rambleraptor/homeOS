/**
 * Pictionary leaderboard — ranks players or teams across every recorded
 * game by total wins, then win rate, then games played. The rank-1 row
 * gets the trophy/amber treatment used elsewhere for winners.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Trophy, Pencil } from 'lucide-react';
import { PageHeader } from '@rambleraptor/homestead-core/shared/components/PageHeader';
import { usePeople } from '../../../people/hooks/usePeople';
import { usePlayerStats } from '../hooks/usePlayerStats';
import { useTeamStats } from '../hooks/useTeamStats';

type Mode = 'players' | 'teams';

interface PersonLite {
  id: string;
  name: string;
}

interface Row {
  /** Stable id for the row (player id or team key). */
  id: string;
  /** Stable id used in test selectors. */
  testId: string;
  /** Display name (player name, or comma-joined team roster). */
  name: string;
  wins: number;
  gamesPlayed: number;
  winRate: number;
}

function nameFor(playerPath: string, people: PersonLite[]): string {
  const id = playerPath.replace(/^people\//, '');
  return people.find((p) => p.id === id)?.name || 'Unknown player';
}

function formatWinRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/**
 * Standard competition ranking ("1224"): rows tied on all three sort keys
 * share a rank; the next distinct row skips ahead by the count of ties.
 */
function computeRanks(rows: Row[]): number[] {
  const ranks: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (i === 0) {
      ranks.push(1);
      continue;
    }
    const prev = rows[i - 1];
    const curr = rows[i];
    const sameAsPrev =
      prev.wins === curr.wins &&
      prev.winRate === curr.winRate &&
      prev.gamesPlayed === curr.gamesPlayed;
    ranks.push(sameAsPrev ? ranks[i - 1] : i + 1);
  }
  return ranks;
}

export function PictionaryLeaderboard() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('players');

  const playerStats = usePlayerStats();
  const teamStats = useTeamStats();
  const { data: people } = usePeople();

  const peopleLite = useMemo<PersonLite[]>(
    () => (people ?? []).map((p) => ({ id: p.id, name: p.name })),
    [people],
  );

  const isLoading =
    mode === 'players' ? playerStats.isLoading : teamStats.isLoading;
  const isError =
    mode === 'players' ? playerStats.isError : teamStats.isError;

  const rows = useMemo<Row[]>(() => {
    if (mode === 'players') {
      return playerStats.data.map((s) => {
        const playerId = s.playerPath.replace(/^people\//, '');
        return {
          id: playerId,
          testId: playerId,
          name: nameFor(s.playerPath, peopleLite),
          wins: s.wins,
          gamesPlayed: s.gamesPlayed,
          winRate: s.winRate,
        };
      });
    }
    return teamStats.data.map((s) => ({
      id: s.teamKey,
      // Stable, selector-safe id derived from the player ids.
      testId: s.playerPaths
        .map((p) => p.replace(/^people\//, ''))
        .join('-'),
      name: s.playerPaths.map((p) => nameFor(p, peopleLite)).join(', '),
      wins: s.wins,
      gamesPlayed: s.gamesPlayed,
      winRate: s.winRate,
    }));
  }, [mode, playerStats.data, teamStats.data, peopleLite]);

  const ranks = useMemo(() => computeRanks(rows), [rows]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/games/pictionary')}
          aria-label="Back to Pictionary"
          data-testid="pictionary-leaderboard-back"
          className="p-2 rounded-md hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <PageHeader
            title="Pictionary Leaderboard"
            subtitle="Ranked by wins, then win rate."
          />
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Leaderboard mode"
        className="inline-flex p-1 bg-gray-100 rounded-lg"
        data-testid="pictionary-leaderboard-mode"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'players'}
          onClick={() => setMode('players')}
          data-testid="pictionary-leaderboard-mode-players"
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            mode === 'players'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Players
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'teams'}
          onClick={() => setMode('teams')}
          data-testid="pictionary-leaderboard-mode-teams"
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            mode === 'teams'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Teams
        </button>
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
            <h3 className="font-semibold text-red-900">
              Failed to load Pictionary leaderboard
            </h3>
          </div>
        </div>
      )}

      {!isLoading && !isError && rows.length === 0 && (
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

      {!isLoading && !isError && rows.length > 0 && (
        <ul className="space-y-2" data-testid="pictionary-leaderboard">
          {rows.map((row, index) => {
            const rank = ranks[index];
            const isTop = rank === 1;
            const testIdSuffix = row.testId;
            return (
              <li key={row.id}>
                <div
                  data-testid={`pictionary-leaderboard-row-${testIdSuffix}`}
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
                      {row.name}
                    </div>
                    <div className="text-sm text-gray-600 mt-0.5">
                      <span
                        data-testid={`pictionary-leaderboard-wins-${testIdSuffix}`}
                      >
                        <span className="font-semibold text-gray-900">
                          {row.wins}
                        </span>{' '}
                        {row.wins === 1 ? 'win' : 'wins'}
                      </span>
                      <span className="text-gray-400"> · </span>
                      <span>
                        {row.gamesPlayed}{' '}
                        {row.gamesPlayed === 1 ? 'game' : 'games'}
                      </span>
                      <span className="text-gray-400"> · </span>
                      <span
                        data-testid={`pictionary-leaderboard-rate-${testIdSuffix}`}
                      >
                        {formatWinRate(row.winRate)} win rate
                      </span>
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
