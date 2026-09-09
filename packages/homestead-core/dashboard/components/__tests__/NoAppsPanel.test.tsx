/**
 * Tests for the dashboard's no-apps empty state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';
import { NoAppsPanel } from '../NoAppsPanel';
import { useAuth } from '@rambleraptor/homestead-core/auth/useAuth';
import { useAppVisible } from '@rambleraptor/homestead-core/apps/useAppVisibility';
import { getFeatureApps } from '@rambleraptor/homestead-core/apps/core-apps';

vi.mock('@rambleraptor/homestead-core/auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@rambleraptor/homestead-core/apps/useAppVisibility', () => ({
  useAppVisible: vi.fn(() => () => true),
}));

vi.mock('@rambleraptor/homestead-core/apps/core-apps', () => ({
  getFeatureApps: vi.fn(() => []),
}));

function app(id: string): AppConfig {
  return { id, name: id, web: { basePath: `/${id}`, routes: [] } } as AppConfig;
}

function mockUser(type: 'superuser' | 'regular') {
  vi.mocked(useAuth).mockReturnValue({
    user: { name: 'Test', type },
  } as ReturnType<typeof useAuth>);
}

describe('NoAppsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppVisible).mockReturnValue(() => true);
    vi.mocked(getFeatureApps).mockReturnValue([]);
  });

  it('tells a superuser how to add the first app when none are installed', () => {
    mockUser('superuser');
    render(<NoAppsPanel />);
    expect(screen.getByTestId('no-apps-panel')).toBeInTheDocument();
    expect(screen.getByText('Add your first app')).toBeInTheDocument();
    expect(screen.getByTestId('no-apps-scaffold-command')).toHaveTextContent(
      'homestead init-app my-app',
    );
    expect(
      screen.getByRole('link', { name: /quick start/i }),
    ).toHaveAttribute('href', 'https://myhomestead.dev/guides/quick-start');
    expect(
      screen.getByRole('link', { name: /example apps/i }),
    ).toHaveAttribute('href', 'https://myhomestead.dev/guides/apps');
  });

  it('points a regular user at their admin when none are installed', () => {
    mockUser('regular');
    render(<NoAppsPanel />);
    expect(screen.getByText('No apps yet')).toBeInTheDocument();
    expect(screen.queryByTestId('no-apps-scaffold-command')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('explains when apps exist but none are visible to the viewer', () => {
    mockUser('regular');
    vi.mocked(getFeatureApps).mockReturnValue([app('todos')]);
    vi.mocked(useAppVisible).mockReturnValue(() => false);
    render(<NoAppsPanel />);
    expect(screen.getByText('Nothing shared with you yet')).toBeInTheDocument();
    expect(screen.queryByText('No apps yet')).toBeNull();
  });

  it('renders nothing once the viewer can see at least one app', () => {
    mockUser('superuser');
    vi.mocked(getFeatureApps).mockReturnValue([app('todos'), app('recipes')]);
    vi.mocked(useAppVisible).mockReturnValue((a) => a.id === 'recipes');
    const { container } = render(<NoAppsPanel />);
    expect(container).toBeEmptyDOMElement();
  });
});
