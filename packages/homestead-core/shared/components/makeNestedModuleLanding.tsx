import type { ComponentType } from 'react';
import { NestedModuleLanding } from './NestedModuleLanding';
import type { HomeModule } from '@rambleraptor/homestead-core/modules/types';

/**
 * Bind a parent module to the generic landing as a no-arg
 * `ComponentType`, suitable for wiring into
 * `OmniboxAdapter.listComponent` from a `.ts` config file. The
 * getter-of-module dance avoids the temporal-dead-zone error you'd
 * get from referencing the in-flight const directly inside its own
 * object literal.
 */
export function makeNestedModuleLanding(
  getModule: () => HomeModule,
): ComponentType {
  function NestedLanding() {
    return <NestedModuleLanding module={getModule()} />;
  }
  NestedLanding.displayName = 'NestedModuleLanding';
  return NestedLanding;
}
