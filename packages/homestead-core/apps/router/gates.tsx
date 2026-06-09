import type { ComponentType, ReactNode } from 'react';
import { AppEnabledGate } from '../../shared/components/AppEnabledGate';
import { SuperuserGate } from './SuperuserGate';

export type GateName = 'enabled' | 'superuser';

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

export const gateComponents: Record<GateName, ComponentType<GateProps>> = {
  enabled: EnabledGate,
  superuser: SuperuserGateWrapper,
};
