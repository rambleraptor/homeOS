import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@rambleraptor/homestead-core/shared/components/ToastProvider';
import { GameForm } from '../components/GameForm';

// Stub the backend-aware image URL hook so tests don't need a real download.
vi.mock('../hooks/useWinningWordImageUrl', () => ({
  useWinningWordImageUrl: vi.fn((game) =>
    game?.winning_word_image
      ? `http://test.com/${game.winning_word_image}`
      : null,
  ),
}));

const PEOPLE = [
  { id: 'a', name: 'Alice' },
  { id: 'b', name: 'Bob' },
  { id: 'c', name: 'Carol' },
  { id: 'd', name: 'Dan' },
];

function renderForm(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
}

describe('GameForm', () => {
  it('starts with two empty teams and disables submit until rosters are filled', () => {
    renderForm(
      <GameForm
        people={PEOPLE}
        onSubmit={() => {}}
        onCancel={() => {}}
        submitLabel="Save"
      />,
    );
    expect(screen.getByTestId('team-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('team-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('pictionary-submit-button')).toBeDisabled();
  });

  it('submits a game with two teams and a winner', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderForm(
      <GameForm
        people={PEOPLE}
        onSubmit={onSubmit}
        onCancel={() => {}}
        submitLabel="Save Game"
      />,
    );

    // Date defaults to today; tweak winning-word + location.
    await user.type(screen.getByTestId('pictionary-location'), 'Orlando');
    await user.type(
      screen.getByTestId('pictionary-winning-word'),
      'Eiffel Tower',
    );

    // Team 0: Alice + Bob (winner)
    await user.click(screen.getByTestId('team-0-player-a'));
    await user.click(screen.getByTestId('team-0-player-b'));
    await user.click(screen.getByTestId('team-0-winner'));

    // Team 1: Carol + Dan
    await user.click(screen.getByTestId('team-1-player-c'));
    await user.click(screen.getByTestId('team-1-player-d'));

    await user.click(screen.getByTestId('pictionary-submit-button'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.location).toBe('Orlando');
    expect(payload.winning_word).toBe('Eiffel Tower');
    expect(payload.teams).toHaveLength(2);
    expect(payload.teams[0].players).toEqual(['people/a', 'people/b']);
    expect(payload.teams[0].won).toBe(true);
    expect(payload.teams[1].players).toEqual(['people/c', 'people/d']);
    expect(payload.teams[1].won).toBe(false);
  });

  it('only one team can be marked the winner', async () => {
    const user = userEvent.setup();
    renderForm(
      <GameForm
        people={PEOPLE}
        onSubmit={() => {}}
        onCancel={() => {}}
        submitLabel="Save"
      />,
    );

    await user.click(screen.getByTestId('team-0-winner'));
    expect(screen.getByTestId('team-0-winner')).toBeChecked();

    await user.click(screen.getByTestId('team-1-winner'));
    expect(screen.getByTestId('team-1-winner')).toBeChecked();
    expect(screen.getByTestId('team-0-winner')).not.toBeChecked();
  });

  it('add team appends a new row that can be removed', async () => {
    const user = userEvent.setup();
    renderForm(
      <GameForm
        people={PEOPLE}
        onSubmit={() => {}}
        onCancel={() => {}}
        submitLabel="Save"
      />,
    );

    await user.click(screen.getByTestId('add-team-button'));
    expect(screen.getByTestId('team-row-2')).toBeInTheDocument();

    await user.click(screen.getByTestId('team-2-remove'));
    expect(screen.queryByTestId('team-row-2')).not.toBeInTheDocument();
  });

  it('cannot remove a team when only the minimum two remain', () => {
    renderForm(
      <GameForm
        people={PEOPLE}
        onSubmit={() => {}}
        onCancel={() => {}}
        submitLabel="Save"
      />,
    );
    expect(screen.queryByTestId('team-0-remove')).not.toBeInTheDocument();
    expect(screen.queryByTestId('team-1-remove')).not.toBeInTheDocument();
  });

  it('passes the picked winning-word image up on submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderForm(
      <GameForm
        people={PEOPLE}
        onSubmit={onSubmit}
        onCancel={() => {}}
        submitLabel="Save"
      />,
    );

    await user.click(screen.getByTestId('team-0-player-a'));
    await user.click(screen.getByTestId('team-0-winner'));
    await user.click(screen.getByTestId('team-1-player-b'));

    const file = new File(['fake'], 'pic.png', { type: 'image/png' });
    await user.upload(
      screen.getByTestId('pictionary-winning-word-image-input'),
      file,
    );
    expect(
      screen.getByTestId('pictionary-winning-word-image-preview'),
    ).toBeInTheDocument();

    await user.click(screen.getByTestId('pictionary-submit-button'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].winning_word_image).toBe(file);
  });

  it('shows the existing remote winning-word image when editing', () => {
    renderForm(
      <GameForm
        people={PEOPLE}
        initialGame={{
          id: 'g1',
          path: 'pictionary-games/g1',
          played_at: '2024-09-21T00:00:00Z',
          winning_word_image: 'pic_abc.png',
          create_time: '2024-09-21T00:00:00Z',
          update_time: '2024-09-21T00:00:00Z',
        }}
        initialTeams={[
          {
            id: 't1',
            path: 'pictionary-games/g1/pictionary-teams/t1',
            players: ['people/a'],
            won: true,
            create_time: '2024-09-21T00:00:00Z',
            update_time: '2024-09-21T00:00:00Z',
          },
          {
            id: 't2',
            path: 'pictionary-games/g1/pictionary-teams/t2',
            players: ['people/b'],
            won: false,
            create_time: '2024-09-21T00:00:00Z',
            update_time: '2024-09-21T00:00:00Z',
          },
        ]}
        onSubmit={() => {}}
        onCancel={() => {}}
        submitLabel="Save"
      />,
    );

    const preview = screen.getByTestId(
      'pictionary-winning-word-image-preview',
    ) as HTMLImageElement;
    expect(preview.src).toContain('pic_abc.png');
  });

  it('preloads existing game and teams when editing', () => {
    const onSubmit = vi.fn();
    renderForm(
      <GameForm
        people={PEOPLE}
        initialGame={{
          id: 'g1',
          path: 'pictionary-games/g1',
          played_at: '2024-09-21T00:00:00Z',
          location: 'Michigan',
          winning_word: 'Bite the bullet',
          create_time: '2024-09-21T00:00:00Z',
          update_time: '2024-09-21T00:00:00Z',
        }}
        initialTeams={[
          {
            id: 't1',
            path: 'pictionary-games/g1/pictionary-teams/t1',
            players: ['people/a'],
            won: true,
            create_time: '2024-09-21T00:00:00Z',
            update_time: '2024-09-21T00:00:00Z',
          },
          {
            id: 't2',
            path: 'pictionary-games/g1/pictionary-teams/t2',
            players: ['people/b'],
            won: false,
            create_time: '2024-09-21T00:00:00Z',
            update_time: '2024-09-21T00:00:00Z',
          },
        ]}
        onSubmit={onSubmit}
        onCancel={() => {}}
        submitLabel="Save"
      />,
    );

    expect(
      (screen.getByTestId('pictionary-location') as HTMLInputElement).value,
    ).toBe('Michigan');
    expect(
      (screen.getByTestId('pictionary-winning-word') as HTMLInputElement).value,
    ).toBe('Bite the bullet');
    expect(screen.getByTestId('team-0-winner')).toBeChecked();
    expect(screen.getByTestId('team-1-winner')).not.toBeChecked();
  });
});
