/**
 * Tests for the useTeamStats aggregation hook.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { useTeamStats } from '../hooks/useTeamStats';
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

describe('useTeamStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty array when there are no games', async () => {
    mockGamesReturn([]);
    mockTeamsByGame({});

    const { result } = renderHook(() => useTeamStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.data).toEqual([]);
  });

  it('treats the same roster across games as a single team', async () => {
    mockGamesReturn([makeGame('g1'), makeGame('g2')]);
    mockTeamsByGame({
      g1: [
        makeTeam('t1', ['people/alice', 'people/bob'], true),
        makeTeam('t2', ['people/carol'], false),
      ],
      g2: [
        // Same roster as t1 but listed in reverse order.
        makeTeam('t3', ['people/bob', 'people/alice'], true),
        makeTeam('t4', ['people/carol'], false),
      ],
    });

    const { result } = renderHook(() => useTeamStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data.length).toBe(2);
    });

    const ab = result.current.data.find(
      (t) => t.teamKey === 'people/alice|people/bob',
    );
    expect(ab).toBeDefined();
    expect(ab!.wins).toBe(2);
    expect(ab!.gamesPlayed).toBe(2);
    expect(ab!.winRate).toBe(1);
    expect(ab!.playerPaths).toEqual(['people/alice', 'people/bob']);

    const carol = result.current.data.find(
      (t) => t.teamKey === 'people/carol',
    );
    expect(carol!.wins).toBe(0);
    expect(carol!.gamesPlayed).toBe(2);
  });

  it('treats different rosters as different teams', async () => {
    mockGamesReturn([makeGame('g1'), makeGame('g2')]);
    mockTeamsByGame({
      g1: [
        makeTeam('t1', ['people/alice', 'people/bob'], true),
        makeTeam('t2', ['people/carol'], false),
      ],
      g2: [
        makeTeam('t3', ['people/alice', 'people/carol'], true),
        makeTeam('t4', ['people/bob'], false),
      ],
    });

    const { result } = renderHook(() => useTeamStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data.length).toBe(4);
    });

    const keys = result.current.data.map((t) => t.teamKey);
    expect(keys).toContain('people/alice|people/bob');
    expect(keys).toContain('people/alice|people/carol');
    expect(keys).toContain('people/bob');
    expect(keys).toContain('people/carol');
  });

  it('sorts by wins desc, then win rate desc, then games played desc', async () => {
    // ab: 3W / 4G (75%)
    // cd: 2W / 2G (100%)
    // ef: 2W / 3G (67%)
    mockGamesReturn([
      makeGame('g1'),
      makeGame('g2'),
      makeGame('g3'),
      makeGame('g4'),
    ]);
    mockTeamsByGame({
      g1: [
        makeTeam('t1', ['people/alice', 'people/bob'], true),
        makeTeam('t2', ['people/carol', 'people/dan'], false),
        makeTeam('t3', ['people/eve', 'people/frank'], false),
      ],
      g2: [
        makeTeam('t4', ['people/alice', 'people/bob'], true),
        makeTeam('t5', ['people/eve', 'people/frank'], true),
      ],
      g3: [
        makeTeam('t6', ['people/alice', 'people/bob'], true),
        makeTeam('t7', ['people/carol', 'people/dan'], true),
        makeTeam('t8', ['people/eve', 'people/frank'], false),
      ],
      g4: [
        makeTeam('t9', ['people/alice', 'people/bob'], false),
        makeTeam('t10', ['people/carol', 'people/dan'], true),
        makeTeam('t11', ['people/eve', 'people/frank'], true),
      ],
    });

    const { result } = renderHook(() => useTeamStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data.length).toBe(3);
    });

    const keys = result.current.data.map((t) => t.teamKey);
    // ab first on wins. cd & ef both have 2 wins; cd's 100% beats ef's 67%.
    expect(keys).toEqual([
      'people/alice|people/bob',
      'people/carol|people/dan',
      'people/eve|people/frank',
    ]);
  });

  it('ignores empty teams (zero players)', async () => {
    mockGamesReturn([makeGame('g1')]);
    mockTeamsByGame({
      g1: [
        makeTeam('t1', ['people/alice'], true),
        makeTeam('t2', [], false),
      ],
    });

    const { result } = renderHook(() => useTeamStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data.length).toBe(1);
    });
    expect(result.current.data[0].teamKey).toBe('people/alice');
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

    const { result } = renderHook(() => useTeamStats(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toEqual([]);
  });
});
