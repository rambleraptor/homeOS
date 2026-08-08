import type { AppRouteProps } from '@rambleraptor/homestead-core/apps/types';
import { PersonDetail } from './PersonDetail';

export function PersonDetailRoute({ params }: AppRouteProps) {
  return <PersonDetail personId={params?.id ?? ''} />;
}
