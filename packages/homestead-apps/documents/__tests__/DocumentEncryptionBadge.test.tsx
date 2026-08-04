/**
 * The encryption-at-rest badge shown on the document detail page. Presentational,
 * driven entirely by the `encrypted` prop, so it's tested directly.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DocumentEncryptionBadge } from '../components/DocumentEncryptionBadge';

describe('DocumentEncryptionBadge', () => {
  it('reads as encrypted when the file bytes are encrypted at rest', () => {
    render(<DocumentEncryptionBadge encrypted />);
    const badge = screen.getByTestId('document-encryption');
    expect(badge).toHaveTextContent('Encrypted');
    expect(badge).not.toHaveTextContent('Not encrypted');
    expect(badge).toHaveAttribute('data-encrypted', 'true');
  });

  it('reads as not encrypted for plaintext (legacy) files', () => {
    render(<DocumentEncryptionBadge encrypted={false} />);
    const badge = screen.getByTestId('document-encryption');
    expect(badge).toHaveTextContent('Not encrypted');
    expect(badge).toHaveAttribute('data-encrypted', 'false');
  });
});
