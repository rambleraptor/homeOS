/**
 * The placeholder rows are the only thing on screen between a drop landing and
 * the list polling the record back, so what they claim about the batch has to
 * be right: one row per file, and exactly one of them presented as in flight.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PendingUploadRows } from '../components/PendingUploadRows';

describe('PendingUploadRows', () => {
  it('renders nothing when no upload is in flight', () => {
    render(<PendingUploadRows uploads={[]} />);
    expect(screen.queryByTestId('document-pending-uploads')).toBeNull();
  });

  it('gives every file in the batch a row', () => {
    render(
      <PendingUploadRows
        uploads={[
          { id: '0-w2.pdf', name: 'w2.pdf', active: true },
          { id: '1-1099.pdf', name: '1099.pdf', active: false },
          { id: '2-receipt.jpg', name: 'receipt.jpg', active: false },
        ]}
      />,
    );

    expect(screen.getAllByTestId('document-pending-upload')).toHaveLength(3);
    expect(screen.getByText('w2.pdf')).toBeInTheDocument();
    expect(screen.getByText('receipt.jpg')).toBeInTheDocument();
  });

  it('separates the file being sent from the ones behind it', () => {
    render(
      <PendingUploadRows
        uploads={[
          { id: '0-a.pdf', name: 'a.pdf', active: true },
          { id: '1-b.pdf', name: 'b.pdf', active: false },
        ]}
      />,
    );

    const rows = screen.getAllByTestId('document-pending-upload');
    expect(rows[0]).toHaveAttribute('data-upload-active', 'true');
    expect(rows[1]).not.toHaveAttribute('data-upload-active');
    expect(screen.getByText('Uploading…')).toBeInTheDocument();
    expect(screen.getByText('Waiting to upload')).toBeInTheDocument();
  });

  it('keeps rows distinct when two dropped files share a name', () => {
    render(
      <PendingUploadRows
        uploads={[
          { id: '0-scan.pdf', name: 'scan.pdf', active: true },
          { id: '1-scan.pdf', name: 'scan.pdf', active: false },
        ]}
      />,
    );

    expect(screen.getAllByTestId('document-pending-upload')).toHaveLength(2);
  });
});
