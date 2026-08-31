/**
 * Health E2E helpers — seed vaccination records via the aepbase REST API.
 */

import { deleteIfPresent, e2eClient } from '../../../../tests/e2e/utils/aepbase-helpers';

export interface VaccinationRecord {
  id: string;
  vaccine: string;
  date_administered: string;
  dose?: string;
  provider?: string;
  lot_number?: string;
  next_due?: string;
  document?: string;
  notes?: string;
}

export type VaccinationSeed = Omit<VaccinationRecord, 'id'>;

export const testVaccinations: VaccinationSeed[] = [
  {
    vaccine: 'Tdap',
    date_administered: '2024-05-12',
    dose: 'booster',
    provider: 'CVS Pharmacy',
    next_due: '2034-05-12',
  },
  {
    vaccine: 'COVID-19 (Moderna)',
    date_administered: '2025-10-01',
    dose: '1 of 1',
    provider: 'Walgreens',
  },
  {
    vaccine: 'Influenza',
    date_administered: '2025-10-01',
    provider: 'Walgreens',
    notes: 'Quadrivalent',
  },
];

export async function createVaccination(
  token: string,
  data: VaccinationSeed,
): Promise<VaccinationRecord> {
  return e2eClient(token).collection<VaccinationRecord>('vaccinations').create(data);
}

export async function listVaccinations(token: string): Promise<VaccinationRecord[]> {
  return e2eClient(token).collection<VaccinationRecord>('vaccinations').listAll();
}

export async function getVaccination(
  token: string,
  id: string,
): Promise<VaccinationRecord> {
  return e2eClient(token).collection<VaccinationRecord>('vaccinations').get(id);
}

/** The private access model scopes the list to the caller, so this deletes
 *  only the calling user's own records. */
export async function deleteAllVaccinations(token: string) {
  const items = await listVaccinations(token);
  for (const item of items) {
    await deleteIfPresent(token, 'vaccinations', item.id);
  }
}
