import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import { VACCINATIONS } from '../resources';
import { buildVaccinationBody } from '../utils/vaccinationBody';
import type { Vaccination, VaccinationFormData } from '../types';

export function useCreateVaccination() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: VaccinationFormData): Promise<Vaccination> => {
      const userId = aepbase.getCurrentUser()?.id;
      const createdBy = userId ? `users/${userId}` : undefined;
      // Multipart POST when a record image is present so aepbase's file-field
      // handler picks it up; plain JSON otherwise.
      return aepbase.create<Vaccination>(
        VACCINATIONS,
        buildVaccinationBody(data, { createdBy }),
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
