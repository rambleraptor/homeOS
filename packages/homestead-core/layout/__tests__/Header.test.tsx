/**
 * Tests for the Header's top-bar app rendering: apps with
 * `placement: 'topbar'` show as icon buttons with optional badges and
 * navigate to their basePath on click.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { initializeAppRegistry } from '@rambleraptor/homestead-core/apps/registry';
import { Header } from '../Header';
import { TopBarBadge } from '../TopBarBadge';
import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';

const enabledIds = new Set(['bell', 'plain', 'side']);
vi.mock('@rambleraptor/homestead-core/apps/useAppVisibility', () => ({
  useAppVisible: () => (app: { id: string }) => enabledIds.has(app.id),
}));

function BellBadge() {
  return <TopBarBadge count={3} />;
}

const makeApp = (
  overrides: Partial<Omit<AppConfig, 'web'>> & { web?: Partial<NonNullable<AppConfig['web']>> },
): AppConfig => {
  const { web, ...rest } = overrides;
  return {
    id: 'app',
    name: 'App',
    description: 'test app',
    ...rest,
    web: {
      icon: () => import('lucide-react').then((m) => m.Bell),
      basePath: '/app',
      routes: [],
      ...web,
    },
  };
};

const apps: AppConfig[] = [
  makeApp({
    id: 'bell',
    name: 'Bell',
    web: {
      basePath: '/bell',
      placement: 'topbar',
      topBarBadge: () => Promise.resolve(BellBadge),
    },
  }),
  makeApp({ id: 'plain', name: 'Plain', web: { basePath: '/plain', placement: 'topbar' } }),
  makeApp({ id: 'side', name: 'Side', web: { basePath: '/side' } }),
  makeApp({
    id: 'gated',
    name: 'Gated',
    web: { basePath: '/gated', placement: 'topbar' },
  }),
];

function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}

function renderHeader(props: Partial<ComponentProps<typeof Header>> = {}) {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Header onMenuClick={() => undefined} {...props} />
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

  it('omits the desktop sidebar toggle when no handler is given', () => {
    renderHeader();
    expect(screen.queryByTestId('desktop-sidebar-toggle')).not.toBeInTheDocument();
  });

  it('toggles the desktop sidebar and labels the button by current state', () => {
    const onDesktopSidebarToggle = vi.fn();
    const { rerender } = renderHeader({ onDesktopSidebarToggle });

    const toggle = screen.getByTestId('desktop-sidebar-toggle');
    expect(toggle).toHaveAttribute('aria-label', 'Hide sidebar');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(toggle);
    expect(onDesktopSidebarToggle).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Header
          onMenuClick={() => undefined}
          onDesktopSidebarToggle={onDesktopSidebarToggle}
          desktopSidebarHidden
        />
      </MemoryRouter>,
    );
    const shown = screen.getByTestId('desktop-sidebar-toggle');
    expect(shown).toHaveAttribute('aria-label', 'Show sidebar');
    expect(shown).toHaveAttribute('aria-expanded', 'false');
  });
});
