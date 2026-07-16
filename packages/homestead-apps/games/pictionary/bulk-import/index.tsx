/**
 * Pictionary bulk import — the standardized page.
 *
 * The columns, the player-name resolution, and the game + team writes are all
 * declared server-side on the pictionary-game resource (`bulkImport` in
 * `../resources.ts`, parser and saver in `../methods/bulk-import-csv.ts`). The
 * page no longer loads the People map itself — the parser does, so preview
 * validation and the import can't disagree about who exists.
 */

import { BulkImportContainer } from '@rambleraptor/homestead-core/shared/bulk-import';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { PICTIONARY_GAMES } from '../resources';
import { GamePreview } from './GamePreview';

export function PictionaryBulkImport() {
  return (
    <BulkImportContainer
      config={{
        plural: PICTIONARY_GAMES,
        appName: 'Pictionary Games',
        appNamePlural: 'pictionary games',
        backRoute: '/games/pictionary',
        queryKey: queryKeys.app('pictionary').all(),
        preview: GamePreview,
      }}
    />
  );
}
