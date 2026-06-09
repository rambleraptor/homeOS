import { NestedAppLanding } from '@rambleraptor/homestead-core/shared/components/NestedAppLanding';
import { superuserApp } from './app.config';

export function SuperuserLanding() {
  return <NestedAppLanding app={superuserApp} />;
}
