/**
 * The confidence ring. The number still has to be readable — the visual is an
 * addition, not a replacement — and the band has to change where it says it
 * changes, since that's the only part carrying "you might want to check this".
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfidenceMeter } from '../components/ConfidenceMeter';

function band(): string | null {
  return screen.getByTestId('document-confidence').getAttribute('data-confidence-band');
}

describe('ConfidenceMeter', () => {
  it('shows the confidence as a whole percentage', () => {
    render(<ConfidenceMeter value={0.784} />);
    expect(screen.getByTestId('document-confidence')).toHaveTextContent('78');
  });

  it('reads high at or above 85%', () => {
    render(<ConfidenceMeter value={0.85} />);
    expect(band()).toBe('high');
  });

  it('reads moderate between 60% and 85%', () => {
    render(<ConfidenceMeter value={0.7} />);
    expect(band()).toBe('moderate');
  });

  it('reads low below 60%', () => {
    render(<ConfidenceMeter value={0.42} />);
    expect(band()).toBe('low');
  });

  it('clamps a value outside 0-1 rather than drawing past the ring', () => {
    const { unmount } = render(<ConfidenceMeter value={1.4} />);
    expect(screen.getByTestId('document-confidence')).toHaveTextContent('100');
    unmount();

    render(<ConfidenceMeter value={-0.2} />);
    expect(screen.getByTestId('document-confidence')).toHaveTextContent('0');
  });

  it('spells the value out for a hover', () => {
    render(<ConfidenceMeter value={0.92} />);
    const title = screen.getByTestId('document-confidence').getAttribute('title');
    expect(title).toContain('92%');
    expect(title).toContain('high');
  });
});
