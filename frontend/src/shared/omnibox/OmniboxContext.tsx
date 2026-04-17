'use client';

/**
 * Omnibox filter context.
 *
 * Carries the parsed intent's filters into whatever `listComponent` the
 * adapter renders. The provider takes the module's filter declarations
 * plus the LLM-supplied values and turns them into a single CEL string;
 * list components read it via `useOmniboxCelFilter()` and forward it to
 * `aepbase.list({ filter })`.
 *
 * When no omnibox is active (normal module page) the hook is inert —
 * existing module pages behave exactly as before.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { buildCelFilter } from '@/shared/omnibox/buildCelFilter';
import type { OmniboxFilterDecl } from '@/shared/omnibox/types';

interface OmniboxFilterContextValue {
  moduleId: string;
  /** CEL expression suitable for `aepbase.list({ filter })`, or undefined. */
  cel: string | undefined;
}

const OmniboxFilterContext = createContext<OmniboxFilterContextValue | null>(
  null,
);

interface OmniboxFilterProviderProps {
  moduleId: string;
  /** Module's declared omnibox filters (from its `OmniboxAdapter`). */
  decls: OmniboxFilterDecl[];
  /** Plain values produced by the omnibox parse. */
  values: Record<string, unknown>;
  children: ReactNode;
}

export function OmniboxFilterProvider({
  moduleId,
  decls,
  values,
  children,
}: OmniboxFilterProviderProps) {
  const cel = useMemo(
    () => buildCelFilter(decls, values),
    [decls, values],
  );
  const value = useMemo(
    () => ({ moduleId, cel }),
    [moduleId, cel],
  );
  return (
    <OmniboxFilterContext.Provider value={value}>
      {children}
    </OmniboxFilterContext.Provider>
  );
}

/**
 * Called by module list components to receive the CEL filter built from
 * the active omnibox intent. The callback runs once per CEL change.
 * Outside an omnibox context the hook is inert.
 */
export function useOmniboxCelFilter(
  apply: (cel: string | undefined) => void,
): void {
  const ctx = useContext(OmniboxFilterContext);
  // Keep a stable callback ref so the main effect only re-runs when the
  // CEL string changes.
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  });

  useEffect(() => {
    if (!ctx) return;
    applyRef.current(ctx.cel);
  }, [ctx]);
}

/** Test hook: read the context directly without effects. */
export function useOmniboxFilterContext(): OmniboxFilterContextValue | null {
  return useContext(OmniboxFilterContext);
}
