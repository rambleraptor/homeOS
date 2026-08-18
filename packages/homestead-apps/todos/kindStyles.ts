/**
 * The colour language for personal vs family todos.
 *
 * A todo's kind used to be shown with a 👪 in front of the title, which only
 * marked one of the two states — a personal todo was "the one without the
 * emoji". Colour marks both, reads at a glance down a list, and doesn't
 * interrupt the title text.
 *
 * The mapping lives in one place because the same two colours have to appear
 * on the create buttons and on the rows those buttons produce. That pairing is
 * the entire point: the button you press is the colour you then look for. Two
 * hardcoded copies would eventually disagree, and the moment they do the whole
 * cue stops being trustworthy.
 *
 * ## Why these two
 *
 * They were already the add buttons' colours, so this adopts an association
 * the app had established and left unused everywhere else.
 *
 * They also survive being seen without colour vision. Terracotta is a
 * mid-light warm and navy is near-black, so they differ sharply in lightness,
 * not just hue — in greyscale the rails still read as two clearly different
 * marks. Colour is never the only channel regardless: each rail carries an
 * `sr-only` label for assistive tech.
 */

import type { TodoKind } from './types';

/**
 * Geometry shared by every rail: a thin full-height bar pinned to the edge of
 * the list, out of the row's flow.
 *
 * The rail started life as a small rounded pill sitting *in* the row's flow,
 * between the row's left padding and the title. That read as a stray floating
 * rectangle — an object in the row rather than an edge on it — and, because it
 * took up horizontal space, only the rows that had one: a railed row's title
 * sat ~18px right of an unrailed row's, so the list lost its left edge exactly
 * where lists most need one (the main view mixes railed todos with unrailed
 * synthetic ones).
 *
 * Absolute positioning fixes both at once. The bar is flush with the list's
 * own edge, so it reads as part of the row's border rather than as content,
 * and every title starts at the same x whether its row is railed or not. The
 * containing card clips it, so it picks up the card's rounded corners for
 * free.
 *
 * Callers supply the left offset, since "the edge of the list" is `left-0`
 * inside a full-bleed row and a negative inset inside a padded one.
 */
export const TODO_KIND_RAIL_BASE = 'absolute inset-y-0 w-1';

export interface TodoKindStyle {
  /** Background for the row's leading rail. */
  rail: string;
  /** Background + hover for the matching create button. */
  button: string;
  /** Announced to screen readers, and the rail's hover title. */
  label: string;
}

export const TODO_KIND_STYLE: Record<TodoKind, TodoKindStyle> = {
  personal: {
    rail: 'bg-accent-terracotta',
    button: 'bg-accent-terracotta hover:bg-accent-terracotta-hover',
    label: 'Personal todo',
  },
  family: {
    rail: 'bg-brand-navy',
    button: 'bg-brand-navy hover:bg-brand-navy/90',
    label: 'Family todo',
  },
};
