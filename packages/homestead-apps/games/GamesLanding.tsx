import { NestedAppLanding } from '@rambleraptor/homestead-core/shared/components/NestedAppLanding';
import { gamesApp } from './app.config';

export function GamesLanding() {
  return <NestedAppLanding app={gamesApp} />;
}
