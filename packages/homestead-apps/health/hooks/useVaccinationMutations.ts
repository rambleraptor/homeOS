/**
 * Vaccination (dose) mutations. Doses live under their vaccine
 * (`/vaccines/{id}/vaccinations/{id}`), so every call carries the parent
 * path explicitly — and a new record image goes over multipart, which is why
 * these are hand-rolled rather than bound to the generic mutation defaults.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import { VACCINATIONS, VACCINES } from '../resources';
import { buildVaccinationBody } from '../utils/vaccinationBody';
import type { Vaccination, VaccinationFormData } from '../types';

export function useCreateVaccination() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      vaccineId,
      data,
    }: {
      vaccineId: string;
      data: VaccinationFormData;
    }): Promise<Vaccination> => {
      const userId = aepbase.getCurrentUser()?.id;
      const createdBy = userId ? `users/${userId}` : undefined;
      return aepbase.create<Vaccination>(
        VACCINATIONS,
        buildVaccinationBody(data, { createdBy }),
        { parent: [VACCINES, vaccineId] },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.app('health').all(),
      });
    },
    onError: (error) => logger.error('Vaccination creation mutation error', error),
  });
}

export function useUpdateVaccination() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      vaccineId,
      id,
      data,
    }: {
      vaccineId: string;
      id: string;
      data: VaccinationFormData;
    }): Promise<Vaccination> => {
      return aepbase.update<Vaccination>(
        VACCINATIONS,
        id,
        buildVaccinationBody(data, { mode: 'update' }),
        { parent: [VACCINES, vaccineId] },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.app('health').all(),
      });
    },
    onError: (error) => logger.error('Vaccination update mutation error', error),
  });
}

export function useDeleteVaccination() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vaccineId, id }: { vaccineId: string; id: string }) => {
      await aepbase.remove(VACCINATIONS, id, { parent: [VACCINES, vaccineId] });
      return id;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.app('health').all(),
      });
    },
    onError: (error) => logger.error('Vaccination delete mutation error', error),
  });
}
