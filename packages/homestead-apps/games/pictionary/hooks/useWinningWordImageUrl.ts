/**
 * Resolve a Pictionary game's winning-word image to a blob URL the browser
 * can render. Thin wrapper over the shared `useFileFieldUrl`.
 */

import { useFileFieldUrl } from '@rambleraptor/homestead-core/api/resourceHooks';
import { PICTIONARY_GAMES } from '../resources';
import type { PictionaryGame } from '../types';

export function useWinningWordImageUrl(
  game: PictionaryGame | null | undefined,
): string | null {
  return useFileFieldUrl(
    PICTIONARY_GAMES,
    game?.id,
    'winning_word_image',
    game?.winning_word_image,
  );
}
