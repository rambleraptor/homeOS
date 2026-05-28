import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { OmniboxDispatcher } from '../OmniboxDispatcher';
import type { OmniboxAdapter } from '../types';

// Bypass ToastProvider — OmniboxFormView uses it but the list-branch tests
// never reach that code path.
vi.mock('@rambleraptor/homestead-core/shared/components/ToastProvider', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    showToast: vi.fn(),
  }),
}));

// Stub the module registry with a fake module whose listComponent renders
// a unique sentinel.
const TestList = () => <div data-testid="fake-list">FAKE LIST</div>;
const fakeAdapter: OmniboxAdapter = {
  synonyms: ['fake'],
  listComponent: TestList,
};

vi.mock('@rambleraptor/homestead-core/modules/registry', () => ({
  getModuleById: (id: string) =>
    id === 'fake'
      ? {
          id: 'fake',
          name: 'Fake',
          description: 'Fake test module',
          basePath: '/fake',
          omnibox: fakeAdapter,
        }
      : undefined,
}));

function withClient(children: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe('OmniboxDispatcher', () => {

  it('renders the module list component for a list intent', () => {
    render(
      withClient(
        <OmniboxDispatcher
          intent={{
            kind: 'list',
            moduleId: 'fake',
            filters: {},
            confidence: 0.9,
          }}
        />,
      ),
    );
    expect(screen.getByTestId('fake-list')).toBeInTheDocument();
    expect(screen.getByTestId('omnibox-banner')).toBeInTheDocument();
  });

  it('shows a not-recognized banner when intent is null', () => {
    render(withClient(<OmniboxDispatcher intent={null} />));
    expect(screen.getByText(/Didn.+t catch that/i)).toBeInTheDocument();
  });

  it('shows a friendly error when module is not omnibox-enabled', () => {
    render(
      withClient(
        <OmniboxDispatcher
          intent={{
            kind: 'list',
            moduleId: 'ghost',
            confidence: 0.9,
          }}
        />,
      ),
    );
    expect(screen.getByText(/ghost/i)).toBeInTheDocument();
  });

  it('marks the banner as fallback when the parse used keyword matching', () => {
    render(
      withClient(
        <OmniboxDispatcher
          intent={{
            kind: 'list',
            moduleId: 'fake',
            confidence: 0.3,
          }}
          fallback
        />,
      ),
    );
    expect(
      screen.getByText(/didn.+t quite understand/i),
    ).toBeInTheDocument();
  });
});
