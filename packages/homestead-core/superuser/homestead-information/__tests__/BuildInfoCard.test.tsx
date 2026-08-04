/**
 * Build/commit info card. The commit values are build-time `process.env`
 * defines; unset in tests, so they render the 'unknown' fallbacks. This just
 * confirms the section renders its three rows with the moved test ids.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BuildInfoCard } from '../components/BuildInfoCard';

describe('BuildInfoCard', () => {
  it('renders the commit hash, date, and message rows', () => {
    render(<BuildInfoCard />);
    expect(screen.getByTestId('homestead-info-commit-hash')).toBeInTheDocument();
    expect(screen.getByTestId('homestead-info-commit-date')).toBeInTheDocument();
    expect(screen.getByTestId('homestead-info-commit-message')).toBeInTheDocument();
  });
});
