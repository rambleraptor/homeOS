'use client';

/**
 * Client-side adapters for the lazy thunks declared on a `HomeModule`.
 *
 * Module configs declare `icon`, route/widget `component`, and
 * `settingsWidget` as `() => import(...)` thunks (see `LazyComponent` /
 * `LazyIcon` in `./types`). These helpers turn a thunk into a stable
 * `React.lazy` component so client consumers can render it with a
 * Suspense boundary. The cache is keyed on the thunk's function
 * reference — module configs declare each thunk once at module scope, so
 * the same `React.lazy` instance is reused across renders (no remounts).
 */

import {
  lazy,
  Suspense,
  type ComponentType,
  type LazyExoticComponent,
} from 'react';
import type { LazyComponent, LazyIcon } from './types';

const componentCache = new WeakMap<
  object,
  LazyExoticComponent<ComponentType<unknown>>
>();

/**
 * Wrap a `LazyComponent` thunk in a cached `React.lazy`. Handles both
 * default-export (`() => import('./Foo')`) and named-export
 * (`() => import('./Foo').then(m => m.Foo)`) thunks.
 */
export function getLazyComponent<P = unknown>(
  loader: LazyComponent<P>,
): LazyExoticComponent<ComponentType<P>> {
  const cached = componentCache.get(loader);
  if (cached) {
    return cached as unknown as LazyExoticComponent<ComponentType<P>>;
  }
  const Component = lazy(() =>
    loader().then((m) => ('default' in m ? m : { default: m })),
  );
  componentCache.set(
    loader,
    Component as unknown as LazyExoticComponent<ComponentType<unknown>>,
  );
  return Component;
}

type IconProps = { className?: string };

const iconCache = new WeakMap<
  object,
  LazyExoticComponent<ComponentType<IconProps>>
>();

function getLazyIcon(
  loader: LazyIcon,
): LazyExoticComponent<ComponentType<IconProps>> {
  const cached = iconCache.get(loader);
  if (cached) return cached;
  const Icon = lazy(() =>
    loader().then((I) => ({ default: I as unknown as ComponentType<IconProps> })),
  );
  iconCache.set(loader, Icon);
  return Icon;
}

interface ModuleIconProps {
  icon: LazyIcon;
  className?: string;
}

/**
 * Renders a module's lazily-loaded Lucide icon. Falls back to a sized
 * placeholder while the icon chunk loads so layout doesn't shift.
 */
export function ModuleIcon({ icon, className }: ModuleIconProps) {
  const Icon = getLazyIcon(icon);
  return (
    <Suspense fallback={<span className={className} aria-hidden="true" />}>
      <Icon className={className} />
    </Suspense>
  );
}
