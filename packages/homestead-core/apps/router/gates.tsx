import type { ComponentType, ReactNode } from 'react';
import { SuperuserGate } from './SuperuserGate';
import { PermissionGate } from './PermissionGate';
import type { Verb } from '../../permissions/resolve';

/**
 * Route gate names declared on an `AppRoute`. Besides the static `superuser`
 * gate, a parameterized permission gate `permission:<verb>:<resourceType>`
 * guards a route on `can(verb, resourceType)` (design §10). App-level audience
 * is otherwise governed by permissions, not a per-app `enabled` flag.
 */
export type GateName = 'superuser' | `permission:${Verb}:${string}`;

interface GateProps {
  appId: string;
  children: ReactNode;
}

function SuperuserGateWrapper({ children }: GateProps) {
  return <SuperuserGate>{children}</SuperuserGate>;
}

const gateComponents: Record<'superuser', ComponentType<GateProps>> = {
  superuser: SuperuserGateWrapper,
};

/**
 * Wrap `children` in the gate named by `gateName`. Handles the static gate and
 * the parameterized `permission:<verb>:<resourceType>` form. Unknown gate names
 * pass through unwrapped (defensive — validation happens where routes are
 * declared).
 */
export function wrapWithGate(gateName: string, appId: string, children: ReactNode): ReactNode {
  if (gateName.startsWith('permission:')) {
    const [, verb, resourceType] = gateName.split(':');
    if (verb && resourceType) {
      return (
        <PermissionGate verb={verb as Verb} resourceType={resourceType}>
          {children}
        </PermissionGate>
      );
    }
    return children;
  }
  const Gate = gateComponents[gateName as 'superuser'];
  return Gate ? <Gate appId={appId}>{children}</Gate> : children;
}
