import { describe, expect, it } from 'vitest';
import type { DashboardWidget } from '@/modules/types';
import { resolveDashboardWidgets } from '../utils/resolveDashboardWidgets';

const Stub = () => null;

const widgets: DashboardWidget[] = [
  { id: 'a', component: Stub, order: 5 },
  { id: 'b', component: Stub, order: 10 },
  { id: 'c', component: Stub, order: 15 },
];

describe('resolveDashboardWidgets', () => {
  it('falls back to module-declared order when no preference exists', () => {
    expect(resolveDashboardWidgets(widgets, undefined, undefined).map((w) => w.id))
      .toEqual(['a', 'b', 'c']);
  });

  it('respects the user-supplied order', () => {
    expect(
      resolveDashboardWidgets(widgets, ['c', 'a', 'b'], undefined).map((w) => w.id),
    ).toEqual(['c', 'a', 'b']);
  });

  it('appends newly-registered widgets to the end of the user list', () => {
    expect(
      resolveDashboardWidgets(widgets, ['c', 'a'], undefined).map((w) => w.id),
    ).toEqual(['c', 'a', 'b']);
  });

  it('drops ids that no longer exist in the registry', () => {
    expect(
      resolveDashboardWidgets(widgets, ['ghost', 'b', 'a'], undefined).map((w) => w.id),
    ).toEqual(['b', 'a', 'c']);
  });

  it('filters out hidden widgets', () => {
    expect(
      resolveDashboardWidgets(widgets, undefined, ['b']).map((w) => w.id),
    ).toEqual(['a', 'c']);
  });

  it('combines order and hidden lists', () => {
    expect(
      resolveDashboardWidgets(widgets, ['c', 'b', 'a'], ['b']).map((w) => w.id),
    ).toEqual(['c', 'a']);
  });

  it('ignores duplicate ids in the preferred order', () => {
    expect(
      resolveDashboardWidgets(widgets, ['a', 'a', 'b'], undefined).map((w) => w.id),
    ).toEqual(['a', 'b', 'c']);
  });
});
