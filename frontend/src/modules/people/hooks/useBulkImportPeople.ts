import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getCollection, getCurrentUser, Collections } from '@/core/api/pocketbase';
import { queryKeys } from '@/core/api/queryClient';
import type { PersonFormData, NotificationPreference } from '../types';
import { createSharedData, setPartner } from '../utils/sharedDataSync';
import { logger } from '@/core/utils/logger';

interface PersonRecord {
  id: string;
  name: string;
  birthday?: string;
  notification_preferences: NotificationPreference[];
  created_by: string;
  created: string;
  updated: string;
}

interface CreatedPersonInfo {
  record: PersonRecord;
  partnerName?: string;
}

export function useBulkImportPeople() {
  const queryClient = useQueryClient();
  const currentUser = getCurrentUser();

  return useMutation({
    mutationFn: async (people: PersonFormData[]) => {
      // First pass: Create all people and their shared data (without partner relationships)
      const createdPeople: CreatedPersonInfo[] = [];

      for (const personData of people) {
        // Create person record (without address/anniversary - those go in shared_data)
        const personRecord = await getCollection<PersonRecord>(Collections.PEOPLE).create({
          name: personData.name,
          birthday: personData.birthday,
          notification_preferences: personData.notification_preferences,
          created_by: currentUser?.id,
        });

        // Create shared data if address or anniversary provided (without partner for now)
        if (personData.address || personData.anniversary) {
          await createSharedData({
            personId: personRecord.id,
            address: personData.address,
            anniversary: personData.anniversary,
          });
        }

        createdPeople.push({
          record: personRecord,
          partnerName: personData.partner_name,
        });
      }

      // Second pass: Resolve partner relationships by name
      // Build a map of name -> person ID for quick lookups
      const nameToIdMap = new Map<string, string>();
      for (const { record } of createdPeople) {
        // Use lowercase for case-insensitive matching
        nameToIdMap.set(record.name.toLowerCase(), record.id);
      }

      // Also fetch existing people from the database for matching
      const existingPeople = await getCollection<PersonRecord>(Collections.PEOPLE).getFullList();
      for (const person of existingPeople) {
        // Only add if not already in the map (newly created people take precedence)
        if (!nameToIdMap.has(person.name.toLowerCase())) {
          nameToIdMap.set(person.name.toLowerCase(), person.id);
        }
      }

      // Now resolve partner relationships
      const processedPartners = new Set<string>(); // Track to avoid duplicate processing
      for (const { record, partnerName } of createdPeople) {
        if (!partnerName) continue;

        const partnerKey = [record.name.toLowerCase(), partnerName.toLowerCase()].sort().join('|');
        if (processedPartners.has(partnerKey)) {
          // Already processed this pair from the other side
          continue;
        }

        const partnerId = nameToIdMap.get(partnerName.toLowerCase());
        if (partnerId) {
          try {
            // Use setPartner to establish the relationship
            await setPartner(record.id, partnerId);
            processedPartners.add(partnerKey);
            logger.info('Partner relationship established', {
              person: record.name,
              partner: partnerName,
            });
          } catch (error) {
            logger.warn('Failed to establish partner relationship', {
              person: record.name,
              partner: partnerName,
              error,
            });
            // Continue with import even if partner linking fails
          }
        } else {
          logger.warn('Partner not found', {
            person: record.name,
            partnerName,
          });
          // Continue with import - partner just won't be linked
        }
      }

      return createdPeople.map(p => p.record);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.module('people').list(),
      });
    },
  });
}