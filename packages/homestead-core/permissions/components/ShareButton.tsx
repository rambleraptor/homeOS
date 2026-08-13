/**
 * One-line share trigger: a button that opens the generic ShareRecordDialog and
 * owns its open/close state. Renders nothing for callers who can't `manage` the
 * record — the same rule the engine enforces on the grant write — so an app
 * gets a correctly-gated Share action by dropping this next to a record.
 */

import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';
import { useCan } from '../useCan';
import { bareId } from '../hooks';
import { ShareRecordDialog, type ShareRecordDialogProps } from './ShareRecordDialog';

export interface ShareButtonProps
  extends Omit<ShareRecordDialogProps, 'isOpen' | 'onClose'> {
  /** Button label; defaults to "Share". */
  label?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function ShareButton({
  label = 'Share',
  className,
  variant = 'secondary',
  size = 'sm',
  ...dialogProps
}: ShareButtonProps) {
  const can = useCan();
  const [open, setOpen] = useState(false);

  const canManage = can('manage', dialogProps.resourceType, {
    recordId: dialogProps.recordId,
    appId: dialogProps.appId ?? null,
    owner: dialogProps.ownerId ? bareId(dialogProps.ownerId) : undefined,
  });
  if (!canManage) return null;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
        data-testid="share-record-button"
      >
        <Share2 className="mr-2 inline h-4 w-4" />
        {label}
      </Button>
      <ShareRecordDialog {...dialogProps} isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
