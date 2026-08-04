import { PageHeader } from '@rambleraptor/homestead-core/shared/components/PageHeader';
import { BuildInfoCard } from './BuildInfoCard';
import { SecurityCard } from './SecurityCard';

/**
 * The superuser "Homestead Information" page: general instance info. Currently
 * the build/commit details and the encryption-at-rest status.
 */
export function HomesteadInformationHome() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Homestead Information"
        subtitle="Build details and security status for this instance."
      />
      <SecurityCard />
      <BuildInfoCard />
    </div>
  );
}
