/**
 * Resolve a Pictionary game's winning-word image to a blob URL the browser
 * can render. Mirrors `useGiftCardImageUrl`: aepbase's `:download` endpoint
 * is POST-only, so the bytes have to be fetched and blob-URL'd here rather
 * than dropped straight into an `<img src>`.
 */

import { useEffect, useState } from 'react';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import { PICTIONARY_GAMES } from '../resources';
import type { PictionaryGame } from '../types';

export function useWinningWordImageUrl(
  game: PictionaryGame | null | undefined,
): string | null {
  const gameId = game?.id;
  const filename = game?.winning_word_image;

  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId || !filename) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;

    aepbase
      .download(PICTIONARY_GAMES, gameId, 'winning_word_image')
      .then((blob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setUrl(createdUrl);
      })
      .catch((error) => {
        if (cancelled) return;
        logger.error('Failed to download winning-word image', error, {
          gameId,
        });
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [gameId, filename]);

  return gameId && filename ? url : null;
}
