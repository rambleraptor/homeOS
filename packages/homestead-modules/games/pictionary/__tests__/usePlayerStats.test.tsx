/**
 * Tests for the usePlayerStats aggregation hook.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { usePlayerStats } from '../hooks/usePlayerStats';
import { useGames } from '../hooks/useGames';
import type { PictionaryGame, PictionaryTeam } from '../types';

vi.mock('../hooks/useGames', () => ({
  useGames: vi.fn(),
}));

function makeGame(id: string): PictionaryGame {
  return {
    id,
    path: `pictionary-games/${id}`,
    played_at: '2024-01-01T00:00:00Z',
    create_time: '2024-01-01T00:00:00Z',
    update_time: '2024-01-01T00:00:00Z',
  };
}

function makeTeam(
  id: string,
  players: string[],
  won = false,
): PictionaryTeam {
  return {
    id,
    path: `pictionary-games/x/pictionary-teams/${id}`,
    players,
    won,
    create_time: '2024-01-01T00:00:00Z',
    update_time: '2024-01-01T00:00:00Z',
  };
}

function mockGamesReturn(games: PictionaryGame[]) {
  vi.mocked(useGames).mockReturnValue({
    data: games,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as UseQueryResult<PictionaryGame[]>);
}

/**
 * Wire `aepbase.list` so that calls with `parent: ['pictionary-games', id]`
 * resolve to the right team list per game.
 */
function mockTeamsByGame(teamsByGame: Record<string, PictionaryTeam[]>) {
  vi.mocked(aepbase.list).mockImplementation((async (
    _resource: string,
    opts?: { parent?: [string, string] },
  ) => {
    const parent = opts?.parent;
    if (!parent) return [];
    const [, gameId] = parent;
    return teamsByGame[gameId] ?? [];
  }) as typeof aepbase.list);
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('usePlayerStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty array when there are no games', async () => {
    mockGamesReturn([]);
    mockTeamsByGame({});

    const { result } = renderHook(() => usePlayerStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.data).toEqual([]);
  });

  it('counts wins and games for each player in a single game', async () => {
    mockGamesReturn([makeGame('g1')]);
    mockTeamsByGame({
      g1: [
        makeTeam('t1', ['people/alice', 'people/bob'], true),
        makeTeam('t2', ['people/carol', 'people/dan'], false),
      ],
    });

    const { result } = renderHook(() => usePlayerStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data.length).toBe(4);
    });

    const byPath = Object.fromEntries(
      result.current.data.map((s) => [s.playerPath, s]),
    );
    expect(byPath['people/alice']).toMatchObject({
      wins: 1,
      gamesPlayed: 1,
      winRate: 1,
    });
    expect(byPath['people/bob']).toMatchObject({
      wins: 1,
      gamesPlayed: 1,
      winRate: 1,
    });
    expect(byPath['people/carol']).toMatchObject({
      wins: 0,
      gamesPlayed: 1,
      winRate: 0,
    });
    expect(byPath['people/dan']).toMatchObject({
      wins: 0,
      gamesPlayed: 1,
      winRate: 0,
    });
  });

  it('accumulates wins across multiple games', async () => {
    mockGamesReturn([makeGame('g1'), makeGame('g2')]);
    mockTeamsByGame({
      g1: [
        makeTeam('t1', ['people/alice'], true),
        makeTeam('t2', ['people/bob'], false),
      ],
      g2: [
        makeTeam('t3', ['people/alice'], true),
        makeTeam('t4', ['people/bob'], false),
      ],
    });

    const { result } = renderHook(() => usePlayerStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data.length).toBe(2);
    });

    expect(result.current.data[0]).toMatchObject({
      playerPath: 'people/alice',
      wins: 2,
      gamesPlayed: 2,
      winRate: 1,
    });
    expect(result.current.data[1]).toMatchObject({
      playerPath: 'people/bob',
      wins: 0,
      gamesPlayed: 2,
      winRate: 0,
    });
  });

  it('computes win rate when a player wins some games and loses others', async () => {
    mockGamesReturn([makeGame('g1'), makeGame('g2')]);
    mockTeamsByGame({
      g1: [
        makeTeam('t1', ['people/alice'], true),
        makeTeam('t2', ['people/bob'], false),
      ],
      g2: [
        makeTeam('t3', ['people/alice'], false),
        makeTeam('t4', ['people/bob'], true),
      ],
    });

    const { result } = renderHook(() => usePlayerStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data.length).toBe(2);
    });

    const byPath = Object.fromEntries(
      result.current.data.map((s) => [s.playerPath, s]),
    );
    expect(byPath['people/alice']).toMatchObject({
      wins: 1,
      gamesPlayed: 2,
      winRate: 0.5,
    });
    expect(byPath['people/bob']).toMatchObject({
      wins: 1,
      gamesPlayed: 2,
      winRate: 0.5,
    });
  });

  it('sorts by wins desc, then win rate desc, then games played desc', async () => {
    mockGamesReturn([
      makeGame('g1'),
      makeGame('g2'),
      makeGame('g3'),
      makeGame('g4'),
    ]);
    // alice: 3 wins / 4 games (75%)
    // bob:   2 wins / 2 games (100%)
    // carol: 2 wins / 4 games (50%)
    // dan:   2 wins / 3 games (66%)
    mockTeamsByGame({
      g1: [
        makeTeam('t1', ['people/alice', 'people/carol'], true),
        makeTeam('t2', ['people/bob', 'people/dan'], false),
      ],
      g2: [
        makeTeam('t3', ['people/alice', 'people/dan'], true),
        makeTeam('t4', ['people/carol'], false),
      ],
      g3: [
        makeTeam('t5', ['people/alice', 'people/bob'], true),
        makeTeam('t6', ['people/carol'], false),
      ],
      g4: [
        makeTeam('t7', ['people/bob', 'people/dan'], true),
        makeTeam('t8', ['people/alice', 'people/carol'], false),
      ],
    });

    const { result } = renderHook(() => usePlayerStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data.length).toBe(4);
    });

    const paths = result.current.data.map((s) => s.playerPath);
    // alice ranks first on wins (3). Then bob/dan/carol all have 2 wins —
    // bob's 100% rate beats dan's 66% beats carol's 50%.
    expect(paths).toEqual([
      'people/alice',
      'people/bob',
      'people/dan',
      'people/carol',
    ]);
  });

  it('does not double-count a player listed twice in the same game', async () => {
    mockGamesReturn([makeGame('g1')]);
    mockTeamsByGame({
      g1: [
        makeTeam('t1', ['people/alice', 'people/alice'], true),
        makeTeam('t2', ['people/bob'], false),
      ],
    });

    const { result } = renderHook(() => usePlayerStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data.length).toBe(2);
    });

    const byPath = Object.fromEntries(
      result.current.data.map((s) => [s.playerPath, s]),
    );
    expect(byPath['people/alice']).toMatchObject({
      wins: 1,
      gamesPlayed: 1,
    });
  });

  it('reports loading while games are still loading', () => {
    vi.mocked(useGames).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<PictionaryGame[]>);
    mockTeamsByGame({});

    const { result } = renderHook(() => usePlayerStats(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toEqual([]);
  });
});
