/**
 * Client half of the grocery photo import: hand an image to this app's
 * `groceries:process-image` custom method and get back the items the model read
 * off it. The server half (which holds the API key and talks to the model) is
 * `../methods/process-image.ts`.
 *
 * Lived in `homestead-core/services/gemini.ts` until it was noticed that core
 * was calling one feature app's custom method by name — the only consumer was
 * ever this app, so it belongs here.
 */

import { logger } from '@rambleraptor/homestead-core/utils/logger';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { GROCERIES } from '../resources';

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = (reader.result as string).split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export interface ExtractedGroceryItem {
  name: string;
}

export async function extractGroceryItemsFromImage(
  imageFile: File,
): Promise<ExtractedGroceryItem[]> {
  try {
    logger.info('Sending image to backend for processing');
    const base64Image = await fileToBase64(imageFile);

    const response = await aepbase.customMethod<{
      items: ExtractedGroceryItem[];
      message: string;
    }>(GROCERIES, 'process-image', {
      image: base64Image,
      mimeType: imageFile.type,
    });
    logger.info(response.message);
    return response.items;
  } catch (error) {
    logger.error('Failed to extract grocery items from image', error);
    throw new Error('Failed to extract grocery items from image. Please try again.');
  }
}
