import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getCollection, getCurrentUser, Collections } from '@/core/api/pocketbase';
import { queryKeys } from '@/core/api/queryClient';
import { logger } from '@/core/utils/logger';
import type { PersonFormData, NotificationPreference } from '../types';
import { createSharedData, setPartner } from '../utils/sharedDataSync';
import { syncRecurringNotificationsForPerson } from '../utils/notificationSync';

interface PersonRecord {
  id: string;
  name: string;
  birthday?: string;
  notification_preferences: NotificationPreference[];
  created_by: string;
  created: string;
  updated: string;
}

export function useCreatePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PersonFormData) => {
      try {
        const currentUser = getCurrentUser();

        // Create person record (without address/anniversary - those go in shared_data)
        // notification_preferences is kept for backward compatibility but we'll also sync to recurring_notifications
        const personRecord = await getCollection<PersonRecord>(Collections.PEOPLE).create({
          name: data.name,
          birthday: data.birthday,
          notification_preferences: data.notification_preferences,
          created_by: currentUser?.id,
        });

        // Handle shared data
        if (data.partner_id) {
          // Create shared data with partner
          await setPartner(personRecord.id, data.partner_id, {
            addresses: data.addresses,
            anniversary: data.anniversary,
          });
        } else if (data.addresses.length > 0 || data.anniversary) {
          // Create shared data for individual person
          await createSharedData({
            personId: personRecord.id,
            addresses: data.addresses,
            anniversary: data.anniversary,
          });
        }

        // Sync recurring notifications for this person
        await syncRecurringNotificationsForPerson(
          personRecord.id,
          personRecord.name,
          data.birthday,
          data.anniversary,
          data.notification_preferences
        );

        return personRecord;
      } catch (error) {
        logger.error('Failed to create person', error, { personData: data });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.module('people').list(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.module(Collections.RECURRING_NOTIFICATIONS).list(),
      });
    },
    onError: (error) => {
      logger.error('Person creation mutation error', error);
    },
  });
}
