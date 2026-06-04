/**
 * Module-level filter state.
 *
 * `ModuleFiltersProvider` owns the current filter values, exposes setters
 * to `<FilterBar>`, and memoizes the filtered list for the module's list
 * component via `useFilteredItems`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { applyFilters, deriveEnumOptions } from './applyFilters';
import type { ModuleFilterDecl } from './types';

interface FiltersContextValue<T = unknown> {
  moduleId: string;
  decls: ModuleFilterDecl[];
  items: T[];
  values: Record<string, unknown>;
  setValue: (key: string, value: unknown) => void;
  reset: () => void;
  filteredItems: T[];
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

interface ModuleFiltersProviderProps<T> {
  moduleId: string;
  decls: ModuleFilterDecl[];
  items: T[];
  initialValues?: Record<string, unknown>;
  children: ReactNode;
}

export function ModuleFiltersProvider<T>({
  moduleId,
  decls,
  items,
  initialValues,
  children,
}: ModuleFiltersProviderProps<T>) {
  const [values, setValues] = useState<Record<string, unknown>>(
    () => initialValues ?? {},
  );

  // When the dispatcher routes a new intent to the same module, replace
  // the values. React's recommended pattern for deriving state from a
  // changing prop: setState during render, keyed on the prop identity —
  // avoids the cascading-render penalty of setState-in-effect.
  const [lastInitial, setLastInitial] = useState(initialValues);
  if (initialValues !== lastInitial) {
    setLastInitial(initialValues);
    setValues(initialValues ?? {});
  }

  const setValue = useCallback((key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setValues({});
  }, []);

  const filteredItems = useMemo(
    () => applyFilters(items, decls, values),
    [items, decls, values],
  );

  const ctxValue = useMemo<FiltersContextValue<T>>(
    () => ({
      moduleId,
      decls,
      items,
      values,
      setValue,
      reset,
      filteredItems,
    }),
    [moduleId, decls, items, values, setValue, reset, filteredItems],
  );

  return (
    <FiltersContext.Provider value={ctxValue as FiltersContextValue}>
      {children}
    </FiltersContext.Provider>
  );
}

function useFiltersContext(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) {
    throw new Error(
      'Module filter hooks must be used inside <ModuleFiltersProvider>.',
    );
  }
  return ctx;
}

export function useModuleFilterDecls(): ModuleFilterDecl[] {
  return useFiltersContext().decls;
}

export function useModuleFilterValues(): {
  values: Record<string, unknown>;
  setValue: (key: string, value: unknown) => void;
  reset: () => void;
} {
  const { values, setValue, reset } = useFiltersContext();
  return { values, setValue, reset };
}

export function useFilteredItems<T>(): T[] {
  return useFiltersContext().filteredItems as T[];
}

export function useEnumOptions(key: string): string[] {
  const { decls, items } = useFiltersContext();
  return useMemo(() => {
    const decl = decls.find((d) => d.key === key);
    if (!decl) return [];
    return deriveEnumOptions(items, decl);
  }, [decls, items, key]);
}
