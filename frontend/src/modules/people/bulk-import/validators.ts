/**
 * People Bulk Import - Field Validators
 */

import type { FieldValidator } from '@/shared/bulk-import';
import type { NotificationPreference } from '../types';

/**
 * Validates name field
 */
export const validateName: FieldValidator<string> = (value) => {
  const name = value.trim();

  if (!name) {
    return {
      value: '',
      error: 'name is a required field',
    };
  }

  if (name.length > 200) {
    return {
      value: name,
      error: 'name must be 200 characters or less',
    };
  }

  return { value: name };
};

/**
 * Validates address field
 */
export const validateAddress: FieldValidator<string | undefined> = (value) => {
  const address = value.trim();

  if (!address) {
    return { value: undefined };
  }

  if (address.length > 500) {
    return {
      value: address,
      error: 'address must be 500 characters or less',
    };
  }

  return { value: address };
};

/**
 * Validates birthday field (YYYY-MM-DD format)
 */
export const validateBirthday: FieldValidator<string | undefined> = (value) => {
  const birthday = value.trim();

  if (!birthday) {
    return { value: undefined };
  }

  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(birthday)) {
    return {
      value: birthday,
      error: 'birthday must be in YYYY-MM-DD format',
    };
  }

  const date = new Date(birthday);
  const timestamp = date.getTime();

  if (typeof timestamp !== 'number' || Number.isNaN(timestamp)) {
    return {
      value: birthday,
      error: 'birthday must be a valid date',
    };
  }

  if (!date.toISOString().startsWith(birthday)) {
    return {
      value: birthday,
      error: 'birthday must be a valid date',
    };
  }

  return { value: birthday };
};

/**
 * Validates anniversary field (YYYY-MM-DD format)
 */
export const validateAnniversary: FieldValidator<string | undefined> = (value) => {
  const anniversary = value.trim();

  if (!anniversary) {
    return { value: undefined };
  }

  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(anniversary)) {
    return {
      value: anniversary,
      error: 'anniversary must be in YYYY-MM-DD format',
    };
  }

  const date = new Date(anniversary);
  const timestamp = date.getTime();

  if (typeof timestamp !== 'number' || Number.isNaN(timestamp)) {
    return {
      value: anniversary,
      error: 'anniversary must be a valid date',
    };
  }

  if (!date.toISOString().startsWith(anniversary)) {
    return {
      value: anniversary,
      error: 'anniversary must be a valid date',
    };
  }

  return { value: anniversary };
};


/**
 * Validates notification_preferences field
 */
export const validateNotificationPreferences: FieldValidator<
  NotificationPreference[]
> = (value) => {
  const notifValue = value.trim();

  if (!notifValue) {
    return { value: ['day_of'] };
  }

  const parsed = notifValue.split(',').map((v) => v.trim() as NotificationPreference);
  const validPrefs = ['day_of', 'day_before', 'week_before'];
  const invalidPrefs = parsed.filter((p) => !validPrefs.includes(p));

  if (invalidPrefs.length > 0) {
    return {
      value: ['day_of'],
      error: `Invalid notification preferences: ${invalidPrefs.join(', ')}`,
    };
  }

  return { value: parsed };
};
