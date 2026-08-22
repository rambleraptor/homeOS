/**
 * Bar colours for the by-organization breakdown.
 *
 * Medical categories are a fixed taxonomy of four, so each one owns a colour
 * (see `medical/categoryConfig.ts`). Charities are an open set — you can't
 * assign a colour to a name you've never seen — so the palette is cycled by the
 * row's position instead. Bars are sorted by size, so the same charity keeps the
 * same colour for as long as it keeps its rank, and the strip stays readable
 * either way: the colours here separate neighbours rather than mean anything.
 *
 * Class names are written out in full (not composed) so Tailwind's content
 * scanner emits them.
 */

export const ORG_BAR_COLORS: string[] = [
  'bg-emerald-500',
  'bg-blue-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-cyan-500',
  'bg-rose-500',
];

export function orgBarColor(index: number): string {
  return ORG_BAR_COLORS[index % ORG_BAR_COLORS.length];
}
