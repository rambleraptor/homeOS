/**
 * The Home app's single page: what's happening at the house soon (curb pickups)
 * above the records you keep about it (manuals, warranties, policies).
 *
 * Owns the page title so each section below contributes only its own heading.
 */

import { PageHeader } from '@rambleraptor/homestead-core/shared/components/PageHeader';
import { HomeDocuments } from './HomeDocuments';
import { UpcomingPickups } from './UpcomingPickups';

export function HomePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Home"
        subtitle="Curb pickups, manuals, and home records in one place"
      />
      <UpcomingPickups />
      <HomeDocuments />
    </div>
  );
}
