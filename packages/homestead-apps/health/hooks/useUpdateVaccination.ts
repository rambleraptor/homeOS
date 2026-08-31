import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import { VACCINATIONS } from '../resources';
import { buildVaccinationBody } from '../utils/vaccinationBody';
import type { Vaccination, VaccinationFormData } from '../types';

export function useUpdateVaccination() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: VaccinationFormData;
    }): Promise<Vaccination> => {
      // A new record image goes over multipart; plain edits use merge-patch
      // JSON. `record_image: null` is dropped by the body builder, so an edit
      // without a new file leaves the stored image untouched.
      return aepbase.update<Vaccination>(
        VACCINATIONS,
        id,
        buildVaccinationBody(data, { mode: 'update' }),
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
