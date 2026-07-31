import type { ComponentType, ReactNode } from 'react';
import { AppEnabledGate } from '../../shared/components/AppEnabledGate';
import { SuperuserGate } from './SuperuserGate';
import { PermissionGate } from './PermissionGate';
import type { Verb } from '../../permissions/resolve';

/**
 * Route gate names declared on an `AppRoute`. Besides the two static gates, a
 * parameterized permission gate `permission:<verb>:<resourceType>` guards a
 * route on `can(verb, resourceType)` (design §10).
 */
export type GateName = 'enabled' | 'superuser' | `permission:${Verb}:${string}`;

interface GateProps {
  appId: string;
  children: ReactNode;
}

function EnabledGate({ appId, children }: GateProps) {
  return <AppEnabledGate appId={appId}>{children}</AppEnabledGate>;
}

function SuperuserGateWrapper({ children }: GateProps) {
  return <SuperuserGate>{children}</SuperuserGate>;
}

const gateComponents: Record<'enabled' | 'superuser', ComponentType<GateProps>> = {
  enabled: EnabledGate,
  superuser: SuperuserGateWrapper,
};

/**
 * Wrap `children` in the gate named by `gateName`. Handles the static gates and
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
  const Gate = gateComponents[gateName as 'enabled' | 'superuser'];
  return Gate ? <Gate appId={appId}>{children}</Gate> : children;
}
