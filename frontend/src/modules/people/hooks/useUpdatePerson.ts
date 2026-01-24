import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getCollection, Collections } from '@/core/api/pocketbase';
import { queryKeys } from '@/core/api/queryClient';
import { logger } from '@/core/utils/logger';
import type { PersonFormData, NotificationPreference } from '../types';
import {
  findSharedDataForPerson,
  updateSharedData,
  createSharedData,
  setPartner,
  removePartner,
} from '../utils/sharedDataSync';
import { syncRecurringNotificationsForPerson } from '../utils/notificationSync';

interface UpdatePersonData {
  id: string;
  data: PersonFormData;
}

interface PersonRecord {
  id: string;
  name: string;
  birthday?: string;
  notification_preferences: NotificationPreference[];
  created_by: string;
  created: string;
  updated: string;
}

export function useUpdatePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: UpdatePersonData) => {
      logger.debug('Person update mutation called', { id, data });

      // Get current shared data to determine old partner
      const oldSharedData = await findSharedDataForPerson(id);
      const oldPartnerId = oldSharedData
        ? (oldSharedData.person_a === id ? oldSharedData.person_b : oldSharedData.person_a)
        : undefined;

      // Update person record (without address/anniversary)
      // notification_preferences is kept for backward compatibility but we'll also sync to recurring_notifications
      const personRecord = await getCollection<PersonRecord>(Collections.PEOPLE).update(id, {
        name: data.name,
        birthday: data.birthday,
        notification_preferences: data.notification_preferences,
      });
      logger.debug('Person update successful', { id, personRecord });

      // Handle shared data updates
      const newPartnerId = data.partner_id;
      const partnerChanged = oldPartnerId !== newPartnerId;

      if (partnerChanged) {
        // Partner changed
        if (oldPartnerId && !newPartnerId) {
          // Removing partner
          await removePartner(id, oldPartnerId);
        } else if (!oldPartnerId && newPartnerId) {
          // Adding partner
          await setPartner(id, newPartnerId, {
            addresses: data.addresses,
            anniversary: data.anniversary,
          });
        } else if (oldPartnerId && newPartnerId && oldPartnerId !== newPartnerId) {
          // Changing partner
          await removePartner(id, oldPartnerId);
          await setPartner(id, newPartnerId, {
            addresses: data.addresses,
            anniversary: data.anniversary,
          });
        }
      } else if (oldSharedData) {
        // Partner didn't change, just update shared fields
        await updateSharedData(oldSharedData.id, {
          addresses: data.addresses,
          anniversary: data.anniversary,
        });
      } else if (data.addresses.length > 0 || data.anniversary) {
        // No shared data exists, create it
        await createSharedData({
          personId: id,
          addresses: data.addresses,
          anniversary: data.anniversary,
        });
      }

      // Sync recurring notifications for this person (non-blocking)
      // This is a best-effort operation - if it fails, we still want the person to be updated
      try {
        await syncRecurringNotificationsForPerson(
          id,
          data.name,
          data.birthday,
          data.anniversary,
          data.notification_preferences
        );
      } catch (syncError) {
        logger.error('Failed to sync recurring notifications', syncError, { personId: id });
        // Don't throw - notification sync failure shouldn't block person update
      }

      return { personRecord, oldPartnerId, newPartnerId };
    },
    onSuccess: (result, variables) => {
      logger.debug('Person update successful, invalidating queries');

      // Always invalidate the list and the person being updated
      queryClient.invalidateQueries({
        queryKey: queryKeys.module('people').list(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.module('people').detail(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.module(Collections.RECURRING_NOTIFICATIONS).list(),
      });

      // Invalidate new partner's cache (if partner was added or changed)
      if (result.newPartnerId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.module('people').detail(result.newPartnerId),
        });
      }

      // Invalidate old partner's cache (if partner was removed or changed)
      if (result.oldPartnerId && result.oldPartnerId !== result.newPartnerId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.module('people').detail(result.oldPartnerId),
        });
      }
    },
    onError: (error) => {
      logger.error('Person update mutation error', error);
    },
  });
}
