import type { AppRouteProps } from '@rambleraptor/homestead-core/apps/types';
import { DocumentDetail } from './DocumentDetail';

export function DocumentDetailRoute({ params }: AppRouteProps) {
  return <DocumentDetail documentId={params?.id ?? ''} />;
}
