/**
 * Tests for `<NestedAppLanding>`: the generic landing page that a
 * parent app renders to link out to its `children`. Each card is
 * filtered by the child's own built-in `enabled` flag so disabled
 * children are hidden from the landing too.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Gamepad2, Pencil, Flag, Club } from 'lucide-react';
import { NestedAppLanding } from '../NestedAppLanding';
import { useAppEnabledPredicate } from '@rambleraptor/homestead-core/settings/hooks/useIsAppEnabled';
import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';

vi.mock('@rambleraptor/homestead-core/settings/hooks/useIsAppEnabled', () => ({
  useAppEnabledPredicate: vi.fn(),
}));

const route = { path: '', index: true, component: () => Promise.resolve(() => null) };

const minigolf: AppConfig = {
  id: 'minigolf',
  name: 'Mini Golf',
  description: 'Play and track mini golf games',
  web: {
    icon: () => Promise.resolve(Flag),
    basePath: '/games/minigolf',
    routes: [route],
  },
};

const pictionary: AppConfig = {
  id: 'pictionary',
  name: 'Pictionary',
  description: 'Track Pictionary games, teams, and winning words',
  web: {
    icon: () => Promise.resolve(Pencil),
    basePath: '/games/pictionary',
    routes: [route],
  },
};

const bridge: AppConfig = {
  id: 'bridge',
  name: 'Bridge',
  description: 'Record bids for each hand of Bridge',
  web: {
    icon: () => Promise.resolve(Club),
    basePath: '/games/bridge',
    routes: [route],
  },
};

const games: AppConfig = {
  id: 'games',
  name: 'Games',
  description: 'Track games you play with the people in your life',
  children: [minigolf, pictionary, bridge],
  web: {
    icon: () => Promise.resolve(Gamepad2),
    basePath: '/games',
    routes: [route],
  },
};

describe('NestedAppLanding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders one card per child when all are enabled', () => {
    vi.mocked(useAppEnabledPredicate).mockReturnValue(() => true);

    render(
      <MemoryRouter>
        <NestedAppLanding app={games} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('games-link-minigolf')).toBeInTheDocument();
    expect(screen.getByTestId('games-link-pictionary')).toBeInTheDocument();
    expect(screen.getByTestId('games-link-bridge')).toBeInTheDocument();
  });

  it('filters out children whose enabled flag rejects the viewer', () => {
    vi.mocked(useAppEnabledPredicate).mockReturnValue(
      (id) => id !== 'bridge',
    );

    render(
      <MemoryRouter>
        <NestedAppLanding app={games} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('games-link-minigolf')).toBeInTheDocument();
    expect(screen.getByTestId('games-link-pictionary')).toBeInTheDocument();
    expect(screen.queryByTestId('games-link-bridge')).not.toBeInTheDocument();
  });
});
