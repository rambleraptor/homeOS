/**
 * Date formatting and manipulation utilities
 */

/**
 * Parse a date string safely, avoiding timezone issues
 * PocketBase returns dates in "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS.sssZ" format
 * This function extracts the date portion and creates a Date in local time
 * @param dateString Date string from PocketBase
 * @returns Date object in local time
 */
function parseDateString(dateString: string): Date {
  // Extract just the date portion (YYYY-MM-DD)
  const datePortion = dateString.substring(0, 10);
  const [year, month, day] = datePortion.split('-').map(Number);
  // Create date in local time (month is 0-indexed)
  return new Date(year, month - 1, day);
}

export function formatDate(dateString: string, options?: Intl.DateTimeFormatOptions): string {
  const date = new Date(dateString);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  return date.toLocaleDateString('en-US', options || defaultOptions);
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
  if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
  return `${Math.floor(diffInDays / 365)} years ago`;
}

export function isToday(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function isSameDay(date1: string | Date, date2: string | Date): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  );
}

/**
 * Get the next occurrence of an annual date (like a birthday or anniversary)
 * @param date The original date
 * @returns The next occurrence of this date (this year or next year)
 */
export function getNextOccurrence(date: Date): Date {
  const now = new Date();
  // Normalize to start of day for accurate comparison
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  let nextOccurrence = new Date(
    startOfToday.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  // If the date has already passed this year, use next year
  if (nextOccurrence < startOfToday) {
    nextOccurrence = new Date(
      startOfToday.getFullYear() + 1,
      date.getMonth(),
      date.getDate()
    );
  }

  return nextOccurrence;
}

/**
 * Check if a date occurs within the specified number of days from now
 * @param date The date to check
 * @param days Number of days to look ahead (default: 30)
 * @returns True if the next occurrence is within the specified days
 */
export function isUpcoming(date: Date, days: number = 30): boolean {
  const nextOccurrence = getNextOccurrence(date);
  const now = new Date();
  const futureDate = new Date(now);
  futureDate.setDate(now.getDate() + days);

  return nextOccurrence >= now && nextOccurrence <= futureDate;
}

/**
 * Calculate the number of days until the next occurrence of a date
 * @param date The date to check
 * @returns Number of days until the next occurrence
 */
export function getDaysUntil(date: Date): number {
  const now = new Date();
  const nextOccurrence = getNextOccurrence(date);
  const diffTime = nextOccurrence.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Sort items by their upcoming date (soonest first)
 * @param items Array of items
 * @param dateGetter Function to extract date from item
 * @returns Sorted array
 */
export function sortByUpcoming<T>(
  items: T[],
  dateGetter: (item: T) => Date | null
): T[] {
  return [...items].sort((a, b) => {
    const dateA = dateGetter(a);
    const dateB = dateGetter(b);

    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;

    const nextA = getNextOccurrence(dateA);
    const nextB = getNextOccurrence(dateB);

    return nextA.getTime() - nextB.getTime();
  });
}

/**
 * Get upcoming events from a date (birthday and/or anniversary)
 * within the specified number of days
 * @param birthday Birthday date or null
 * @param anniversary Anniversary date or null
 * @param days Number of days to look ahead (default: 30)
 * @returns Array of upcoming events with type and date
 */
export function getUpcomingEvents(
  birthday: string | null,
  anniversary: string | null,
  days: number = 30
): Array<{ type: 'Birthday' | 'Anniversary'; date: Date }> {
  const events: Array<{ type: 'Birthday' | 'Anniversary'; date: Date }> = [];
  const now = new Date();
  // Normalize to start of day for accurate comparison
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const futureDate = new Date(startOfToday);
  futureDate.setDate(startOfToday.getDate() + days);

  if (birthday && birthday.trim() !== '') {
    const birthdayDate = parseDateString(birthday);
    const nextBirthday = getNextOccurrence(birthdayDate);
    if (nextBirthday >= startOfToday && nextBirthday <= futureDate) {
      events.push({ type: 'Birthday', date: nextBirthday });
    }
  }

  if (anniversary && anniversary.trim() !== '') {
    const anniversaryDate = parseDateString(anniversary);
    const nextAnniversary = getNextOccurrence(anniversaryDate);
    if (nextAnniversary >= startOfToday && nextAnniversary <= futureDate) {
      events.push({ type: 'Anniversary', date: nextAnniversary });
    }
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Holiday type definition
 */
export interface Holiday {
  name: string;
  message: string;
}

/**
 * Get the date for Easter Sunday using the Anonymous Gregorian algorithm
 * @param year The year to calculate Easter for
 * @returns Date object for Easter Sunday
 */
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month, day);
}

/**
 * Get the date for Mother's Day (2nd Sunday in May)
 * @param year The year to calculate for
 * @returns Date object for Mother's Day
 */
function getMothersDay(year: number): Date {
  const firstDayOfMay = new Date(year, 4, 1); // May is month 4 (0-indexed)
  const firstSunday = 1 + ((7 - firstDayOfMay.getDay()) % 7);
  const secondSunday = firstSunday + 7;
  return new Date(year, 4, secondSunday);
}

/**
 * Get the date for Father's Day (3rd Sunday in June)
 * @param year The year to calculate for
 * @returns Date object for Father's Day
 */
function getFathersDay(year: number): Date {
  const firstDayOfJune = new Date(year, 5, 1); // June is month 5 (0-indexed)
  const firstSunday = 1 + ((7 - firstDayOfJune.getDay()) % 7);
  const thirdSunday = firstSunday + 14;
  return new Date(year, 5, thirdSunday);
}

/**
 * Get the date for Thanksgiving (4th Thursday in November)
 * @param year The year to calculate for
 * @returns Date object for Thanksgiving
 */
function getThanksgiving(year: number): Date {
  const firstDayOfNov = new Date(year, 10, 1); // November is month 10 (0-indexed)
  const firstThursday = 1 + ((11 - firstDayOfNov.getDay()) % 7);
  const fourthThursday = firstThursday + 21;
  return new Date(year, 10, fourthThursday);
}

/**
 * Get the date for Labor Day (1st Monday in September)
 * @param year The year to calculate for
 * @returns Date object for Labor Day
 */
function getLaborDay(year: number): Date {
  const firstDayOfSept = new Date(year, 8, 1); // September is month 8 (0-indexed)
  const firstMonday = 1 + ((8 - firstDayOfSept.getDay()) % 7);
  return new Date(year, 8, firstMonday);
}

/**
 * Get the date for Memorial Day (Last Monday in May)
 * @param year The year to calculate for
 * @returns Date object for Memorial Day
 */
function getMemorialDay(year: number): Date {
  const lastDayOfMay = new Date(year, 5, 0); // Day 0 of June = last day of May
  const lastMonday = lastDayOfMay.getDate() - ((lastDayOfMay.getDay() + 6) % 7);
  return new Date(year, 4, lastMonday);
}

/**
 * Check if a date matches today
 * @param date The date to check
 * @returns True if the date is today
 */
function isDateToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Get today's holiday if there is one
 * @returns Holiday object if today is a holiday, null otherwise
 */
export function getTodaysHoliday(): Holiday | null {
  const today = new Date();
  const month = today.getMonth(); // 0-indexed
  const day = today.getDate();
  const year = today.getFullYear();

  // Fixed date holidays
  const fixedHolidays: Record<string, Holiday> = {
    '0-1': { name: "New Year's Day", message: "Happy New Year!" },
    '1-14': { name: "Valentine's Day", message: "Happy Valentine's Day!" },
    '2-17': { name: "St. Patrick's Day", message: "Happy St. Patrick's Day!" },
    '6-4': { name: 'Independence Day', message: 'Happy 4th of July!' },
    '9-31': { name: 'Halloween', message: 'Happy Halloween!' },
    '11-24': { name: 'Christmas Eve', message: 'Merry Christmas Eve!' },
    '11-25': { name: 'Christmas', message: 'Merry Christmas!' },
    '11-31': { name: "New Year's Eve", message: "Happy New Year's Eve!" },
  };

  const key = `${month}-${day}`;
  if (fixedHolidays[key]) {
    return fixedHolidays[key];
  }

  // Variable date holidays
  if (isDateToday(getEasterDate(year))) {
    return { name: 'Easter', message: 'Happy Easter!' };
  }

  if (isDateToday(getMothersDay(year))) {
    return { name: "Mother's Day", message: "Happy Mother's Day!" };
  }

  if (isDateToday(getFathersDay(year))) {
    return { name: "Father's Day", message: "Happy Father's Day!" };
  }

  if (isDateToday(getMemorialDay(year))) {
    return { name: 'Memorial Day', message: 'Happy Memorial Day!' };
  }

  if (isDateToday(getLaborDay(year))) {
    return { name: 'Labor Day', message: 'Happy Labor Day!' };
  }

  if (isDateToday(getThanksgiving(year))) {
    return { name: 'Thanksgiving', message: 'Happy Thanksgiving!' };
  }

  return null;
}
