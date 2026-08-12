/**
 * A single waste stream rendered as an icon + label chip. Shared by the Home
 * page section and the dashboard widget so a stream looks the same wherever it
 * appears.
 */

import {
  Biohazard,
  Leaf,
  Recycle,
  Sofa,
  Sprout,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@rambleraptor/homestead-core/shared/lib/utils';
import type { GarbageStream } from '../types';
import { streamLabel } from '../utils/pickups';

const STREAM_ICONS: Record<GarbageStream, LucideIcon> = {
  garbage: Trash2,
  recyclable: Recycle,
  organic: Sprout,
  'yard-waste': Leaf,
  bulk: Sofa,
  hazardous: Biohazard,
};

/** Tone per stream, kept soft to match the Badge palette. */
const STREAM_TONES: Record<GarbageStream, string> = {
  garbage: 'bg-gray-100 text-brand-slate',
  recyclable: 'bg-blue-50 text-blue-700',
  organic: 'bg-green-50 text-green-700',
  'yard-waste': 'bg-green-50 text-green-700',
  bulk: 'bg-orange-50 text-orange-700',
  hazardous: 'bg-red-50 text-red-700',
};

export interface StreamChipProps {
  stream: string;
  className?: string;
}

export function StreamChip({ stream, className }: StreamChipProps) {
  // The wire value is an unconstrained string, so both lookups fall back
  // rather than rendering an empty chip for a stream we don't know yet.
  const Icon = STREAM_ICONS[stream as GarbageStream] ?? Trash2;
  const tone = STREAM_TONES[stream as GarbageStream] ?? 'bg-gray-100 text-brand-slate';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium font-body',
        tone,
        className,
      )}
      data-testid={`pickup-stream-${stream}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {streamLabel(stream)}
    </span>
  );
}
