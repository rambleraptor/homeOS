import type { PersonFormData, NotificationPreference } from '../types';
import { logger } from '@/core/utils/logger';

export interface ParsedPerson {
  data: PersonFormData;
  rowNumber: number;
  isValid: boolean;
  errors: string[];
}

export interface CSVParseResult {
  people: ParsedPerson[];
  totalCount: number;
  validCount: number;
  invalidCount: number;
}

const REQUIRED_HEADERS = ['name'];

const OPTIONAL_HEADERS = [
  'address',
  'wifi_network',
  'wifi_password',
  'birthday',
  'anniversary',
  'notification_preferences',
  'partner_name',
];

const ALL_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];

/**
 * Parses a CSV string into an array of ParsedPerson objects
 */
export function parsePeopleCSV(csvContent: string): CSVParseResult {
  const lines = csvContent.trim().split('\n');

  if (lines.length === 0) {
    return {
      people: [],
      totalCount: 0,
      validCount: 0,
      invalidCount: 0,
    };
  }

  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  // Validate headers
  const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
  }

  // Parse data rows
  const people: ParsedPerson[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    const values = parseCSVLine(line);
    const rowData: Record<string, string> = {};

    headers.forEach((header, index) => {
      rowData[header] = values[index] || '';
    });

    const parsed = parsePersonRow(rowData, i + 1);
    people.push(parsed);
  }

  const validCount = people.filter(p => p.isValid).length;
  const invalidCount = people.length - validCount;

  return {
    people,
    totalCount: people.length,
    validCount,
    invalidCount,
  };
}

/**
 * Parses a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current.trim());

  return result;
}

/**
 * Parses and validates a single person row
 */
function parsePersonRow(row: Record<string, string>, rowNumber: number): ParsedPerson {
  const errors: string[] = [];

  // Parse name
  const name = row.name?.trim() || '';
  if (!name) {
    errors.push('name is required');
  } else if (name.length > 200) {
    errors.push('name must be 200 characters or less');
  }

  // Parse address (optional) - simple string stored in line1
  const addressString = row.address?.trim() || undefined;
  const wifiNetwork = row.wifi_network?.trim() || undefined;
  const wifiPassword = row.wifi_password?.trim() || undefined;

  // Validate address length
  if (addressString && addressString.length > 500) {
    errors.push('address must be 500 characters or less');
  }

  // Validate WiFi fields
  if (wifiPassword && !wifiNetwork) {
    errors.push('wifi_network is required when wifi_password is provided');
  }

  // Build address object if any address/wifi field is provided
  let address: PersonFormData['address'] = undefined;
  if (addressString || wifiNetwork || wifiPassword) {
    address = {
      line1: addressString || '',
      wifi_network: wifiNetwork,
      wifi_password: wifiPassword,
    };
  }

  // Parse birthday (optional) - supports YYYY-MM-DD and MM/DD/YYYY formats
  const rawBirthday = row.birthday?.trim() || undefined;
  let birthday: string | undefined = undefined;
  if (rawBirthday) {
    const parsed = parseAndNormalizeDate(rawBirthday);
    if (parsed) {
      birthday = parsed;
    } else {
      errors.push('birthday must be in YYYY-MM-DD or MM/DD/YYYY format');
    }
  }

  // Parse anniversary (optional) - supports YYYY-MM-DD and MM/DD/YYYY formats
  const rawAnniversary = row.anniversary?.trim() || undefined;
  let anniversary: string | undefined = undefined;
  if (rawAnniversary) {
    const parsed = parseAndNormalizeDate(rawAnniversary);
    if (parsed) {
      anniversary = parsed;
    } else {
      errors.push('anniversary must be in YYYY-MM-DD or MM/DD/YYYY format');
    }
  }

  // Parse notification_preferences (optional, defaults to ['day_of'])
  let notificationPreferences: NotificationPreference[] = ['day_of'];
  const notifValue = row.notification_preferences?.trim();
  if (notifValue) {
    try {
      const parsed = notifValue.split(',').map(v => v.trim() as NotificationPreference);
      const validPrefs = ['day_of', 'day_before', 'week_before'];
      const invalidPrefs = parsed.filter(p => !validPrefs.includes(p));

      if (invalidPrefs.length > 0) {
        errors.push(`Invalid notification preferences: ${invalidPrefs.join(', ')}`);
      } else {
        notificationPreferences = parsed;
      }
    } catch (error) {
      logger.error('Failed to parse notification preferences', error, { rowNumber, notifValue });
      errors.push('notification_preferences must be comma-separated values');
    }
  }

  // Parse partner_name (optional) - will be resolved to partner_id during import
  const partnerName = row.partner_name?.trim() || undefined;

  return {
    data: {
      name,
      address,
      birthday,
      anniversary,
      notification_preferences: notificationPreferences,
      partner_name: partnerName,
    },
    rowNumber,
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Parses and normalizes a date string from YYYY-MM-DD or MM/DD/YYYY format
 * Returns the date in YYYY-MM-DD format if valid, or null if invalid
 */
function parseAndNormalizeDate(dateString: string): string | null {
  const trimmed = dateString.trim();

  // Check for YYYY-MM-DD format
  const isoRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const isoMatch = trimmed.match(isoRegex);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(`${year}-${month}-${day}T00:00:00`);
    if (!isNaN(date.getTime()) && date.toISOString().startsWith(`${year}-${month}-${day}`)) {
      return `${year}-${month}-${day}`;
    }
    return null;
  }

  // Check for MM/DD/YYYY format
  const usRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const usMatch = trimmed.match(usRegex);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    const paddedMonth = month.padStart(2, '0');
    const paddedDay = day.padStart(2, '0');
    const isoDate = `${year}-${paddedMonth}-${paddedDay}`;
    const date = new Date(`${isoDate}T00:00:00`);
    if (!isNaN(date.getTime()) && date.toISOString().startsWith(isoDate)) {
      return isoDate;
    }
    return null;
  }

  return null;
}

/**
 * Generates a sample CSV template for people
 */
function generatePeopleCSVTemplate(): string {
  const headers = ALL_HEADERS.join(',');
  // Example 1: John with address, WiFi, dates, and partner
  const example1 = 'John Doe,"123 Main St, Anytown, CA 12345",HomeWiFi,password123,1990-06-15,2015-08-20,"day_of,week_before",Jane Doe';
  // Example 2: Jane with address and partner
  const example2 = 'Jane Doe,"456 Oak Ave, Springfield, IL",,,,2015-08-20,day_of,John Doe';
  // Example 3: Solo person, minimal data
  const example3 = 'Peter Jones,"789 Pine Ln, Boston, MA",,,1985-12-01,,day_of,';

  return `${headers}\n${example1}\n${example2}\n${example3}`;
}

/**
 * Downloads a CSV template file for people
 */
export function downloadPeopleCSVTemplate(): void {
  const template = generatePeopleCSVTemplate();
  const blob = new Blob([template], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'people_import_template.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
