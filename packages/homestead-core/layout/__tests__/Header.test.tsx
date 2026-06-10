/**
 * Tests for the Header's top-bar app rendering: apps with
 * `placement: 'topbar'` show as icon buttons with optional badges and
 * navigate to their basePath on click.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { initializeAppRegistry } from '@rambleraptor/homestead-core/apps/registry';
import { Header } from '../Header';
import { TopBarBadge } from '../TopBarBadge';
import type { HomeApp } from '@rambleraptor/homestead-core/apps/types';

const enabledIds = new Set(['bell', 'plain', 'side']);
vi.mock('@rambleraptor/homestead-core/settings/hooks/useIsAppEnabled', () => ({
  useAppEnabledPredicate: () => (id: string) => enabledIds.has(id),
}));

function BellBadge() {
  return <TopBarBadge count={3} />;
}

const makeApp = (overrides: Partial<HomeApp>): HomeApp => ({
  id: 'app',
  name: 'App',
  description: 'test app',
  icon: () => import('lucide-react').then((m) => m.Bell),
  basePath: '/app',
  routes: [],
  ...overrides,
});

const apps: HomeApp[] = [
  makeApp({
    id: 'bell',
    name: 'Bell',
    basePath: '/bell',
    placement: 'topbar',
    topBarBadge: () => Promise.resolve(BellBadge),
  }),
  makeApp({ id: 'plain', name: 'Plain', basePath: '/plain', placement: 'topbar' }),
  makeApp({ id: 'side', name: 'Side', basePath: '/side' }),
  makeApp({
    id: 'gated',
    name: 'Gated',
    basePath: '/gated',
    placement: 'topbar',
  }),
];

function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}

function renderHeader() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Header onMenuClick={() => undefined} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  initializeAppRegistry(apps);
});

describe('Header', () => {
  it('renders a button per enabled topbar app and skips sidebar apps', () => {
    renderHeader();
    expect(screen.getByTestId('topbar-app-bell')).toBeInTheDocument();
    expect(screen.getByTestId('topbar-app-plain')).toBeInTheDocument();
    expect(screen.queryByTestId('topbar-app-side')).not.toBeInTheDocument();
  });

  it('hides topbar apps the viewer cannot access', () => {
    renderHeader();
    expect(screen.queryByTestId('topbar-app-gated')).not.toBeInTheDocument();
  });

  it('renders the lazy badge inside the button', async () => {
    renderHeader();
    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  it('navigates to the app basePath on click', () => {
    renderHeader();
    fireEvent.click(screen.getByTestId('topbar-app-plain'));
    expect(screen.getByTestId('location')).toHaveTextContent('/plain');
  });

  it('labels buttons with the app name', () => {
    renderHeader();
    expect(screen.getByLabelText('Bell')).toBeInTheDocument();
  });
});
