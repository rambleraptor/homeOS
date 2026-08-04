/**
 * `<ViewAsBanner>` shows only during a "view as" preview and exits it via
 * `stopViewAs` + a redirect back to the admin surface.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewAsBanner } from '../ViewAsBanner';
import { useAuth } from '../../auth/useAuth';
import type { ViewAsIdentity } from '../../auth/effectiveUser';

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));
vi.mock('../../auth/useAuth', () => ({ useAuth: vi.fn() }));

const stopViewAs = vi.fn();

function mockAuth(viewAs: ViewAsIdentity | null) {
  vi.mocked(useAuth).mockReturnValue({
    viewAs,
    stopViewAs,
  } as unknown as ReturnType<typeof useAuth>);
}

const kid: ViewAsIdentity = {
  id: 'kid',
  name: 'A Kid',
  email: 'kid@example.com',
  type: 'regular',
  permissions: { enforced: true, groupIds: [], groupNames: [], grants: [] },
};

describe('ViewAsBanner', () => {
  beforeEach(() => {
    navigate.mockClear();
    stopViewAs.mockClear();
  });

  it('renders nothing when no preview is active', () => {
    mockAuth(null);
    const { container } = render(<ViewAsBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names the previewed user while a preview is active", () => {
    mockAuth(kid);
    render(<ViewAsBanner />);
    expect(screen.getByTestId('view-as-banner')).toHaveTextContent('A Kid');
  });

  it('exits the preview and returns to the users admin surface', async () => {
    mockAuth(kid);
    render(<ViewAsBanner />);
    await userEvent.click(screen.getByTestId('exit-view-as'));
    expect(stopViewAs).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/superuser/users');
  });

  it('flags a previewed superuser', () => {
    mockAuth({ ...kid, type: 'superuser' });
    render(<ViewAsBanner />);
    expect(screen.getByTestId('view-as-banner')).toHaveTextContent('superuser');
  });
});
