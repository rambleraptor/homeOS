import { describe, expect, it } from 'vitest';
import { buildVaccinationBody } from '../utils/vaccinationBody';
import type { VaccinationFormData } from '../types';

const base: VaccinationFormData = {
  vaccine: 'Tdap',
  date_administered: '2026-08-01',
};

describe('buildVaccinationBody', () => {
  it('returns plain JSON without a record image', () => {
    const body = buildVaccinationBody(
      { ...base, provider: 'CVS' },
      { createdBy: 'users/u1' },
    );
    expect(body).toEqual({
      vaccine: 'Tdap',
      date_administered: '2026-08-01',
      provider: 'CVS',
      created_by: 'users/u1',
    });
  });

  it('drops empty optional fields on create', () => {
    const body = buildVaccinationBody({
      ...base,
      dose: '',
      next_due: undefined,
      document: '',
      record_image: null,
    });
    expect(body).toEqual({ vaccine: 'Tdap', date_administered: '2026-08-01' });
  });

  it('nulls cleared fields on update so merge-patch erases them', () => {
    const body = buildVaccinationBody(
      { ...base, next_due: '', document: '' },
      { mode: 'update' },
    ) as Record<string, unknown>;
    expect(body.next_due).toBeNull();
    expect(body.document).toBeNull();
    // Undefined still means "untouched", even on update.
    expect('dose' in body).toBe(false);
  });

  it('keeps the document id as a bare string', () => {
    const body = buildVaccinationBody({ ...base, document: 'doc123' }) as Record<
      string,
      unknown
    >;
    expect(body.document).toBe('doc123');
  });

  it('switches to FormData when a record image is present', () => {
    const file = new File(['bytes'], 'card.png', { type: 'image/png' });
    const body = buildVaccinationBody(
      { ...base, notes: 'left arm', record_image: file },
      { createdBy: 'users/u1' },
    );
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    expect(form.get('vaccine')).toBe('Tdap');
    expect(form.get('date_administered')).toBe('2026-08-01');
    expect(form.get('notes')).toBe('left arm');
    expect(form.get('created_by')).toBe('users/u1');
    expect(form.get('record_image')).toBe(file);
  });
});
