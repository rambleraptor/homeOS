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
