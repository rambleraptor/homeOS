import { getCollection, Collections } from '@/core/api/pocketbase';
import type { Person, PersonFormData } from '../types';

/**
 * Syncs bidirectional partner relationship and shared fields.
 *
 * When a person sets a partner:
 * 1. The partner's partner_id is set to point back to this person
 * 2. Shared fields (address, anniversary) are synced to the partner
 *
 * When a person removes a partner:
 * 1. The old partner's partner_id is cleared if it pointed to this person
 */
export async function syncPartnerRelationship(
  personId: string,
  newPartnerId: string | undefined,
  oldPartnerId: string | undefined,
  sharedData: {
    address?: string;
    anniversary?: string;
  }
) {
  const peopleCollection = getCollection<Person>(Collections.PEOPLE);

  // Remove old partner relationship if it changed
  if (oldPartnerId && oldPartnerId !== newPartnerId) {
    try {
      const oldPartner = await peopleCollection.getOne(oldPartnerId);
      // Only clear if they were pointing back to us
      if (oldPartner.partner_id === personId) {
        await peopleCollection.update(oldPartnerId, {
          partner_id: '',
        });
      }
    } catch (error) {
      console.error('Failed to clear old partner relationship:', error);
      // Continue anyway - old partner might have been deleted
    }
  }

  // Set new partner relationship and sync shared fields
  if (newPartnerId) {
    try {
      // Prepare update data with bidirectional relationship
      const updateData: Partial<PersonFormData> = {
        partner_id: personId,
      };

      // Sync shared fields
      if (sharedData.address !== undefined) {
        updateData.address = sharedData.address;
      }
      if (sharedData.anniversary !== undefined) {
        updateData.anniversary = sharedData.anniversary;
      }

      await peopleCollection.update(newPartnerId, updateData);
    } catch (error) {
      console.error('Failed to sync partner relationship:', error);
      throw new Error('Failed to sync partner relationship. The partner may not exist.');
    }
  }
}
