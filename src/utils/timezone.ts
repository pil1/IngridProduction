/**
 * Timezone Utilities
 *
 * Utilities for formatting dates and times with timezone support.
 * All dates/times in the application should use these functions to respect user timezones.
 */

import { format, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

/**
 * Format a date/time with user's timezone
 *
 * @param date - Date string or Date object
 * @param timezone - User's timezone (e.g., 'America/New_York')
 * @param formatString - date-fns format string (default: 'PPp' = 'Apr 29, 2023, 9:30 AM')
 * @returns Formatted date string in user's timezone
 *
 * @example
 * formatWithTimezone('2023-04-29T13:30:00Z', 'America/New_York', 'PPp')
 * // => "Apr 29, 2023, 9:30 AM"
 *
 * formatWithTimezone('2023-04-29T13:30:00Z', 'America/Los_Angeles', 'PPp')
 * // => "Apr 29, 2023, 6:30 AM"
 */
export function formatWithTimezone(
  date: string | Date,
  timezone: string = 'America/New_York',
  formatString: string = 'PPp'
): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatInTimeZone(dateObj, timezone, formatString);
  } catch (error) {
    console.error('Error formatting date with timezone:', error);
    return format(typeof date === 'string' ? parseISO(date) : date, formatString);
  }
}

/**
 * Common date format presets
 */
export const DATE_FORMATS = {
  SHORT_DATE: 'MM/dd/yyyy',           // 04/29/2023
  LONG_DATE: 'MMMM d, yyyy',          // April 29, 2023
  SHORT_DATETIME: 'MM/dd/yyyy h:mm a', // 04/29/2023 9:30 AM
  LONG_DATETIME: 'PPp',               // Apr 29, 2023, 9:30 AM
  TIME_ONLY: 'h:mm a',                // 9:30 AM
  ISO_DATE: 'yyyy-MM-dd',             // 2023-04-29
  ISO_DATETIME: "yyyy-MM-dd'T'HH:mm:ss", // 2023-04-29T09:30:00
} as const;

/**
 * Format date based on user's preferred date format
 *
 * @param date - Date string or Date object
 * @param timezone - User's timezone
 * @param dateFormat - User's preferred date format (from profile)
 * @returns Formatted date string
 */
export function formatUserDate(
  date: string | Date,
  timezone: string = 'America/New_York',
  dateFormat: string = 'MM/dd/yyyy'
): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatInTimeZone(dateObj, timezone, dateFormat);
  } catch (error) {
    console.error('Error formatting user date:', error);
    return format(typeof date === 'string' ? parseISO(date) : date, dateFormat);
  }
}

/**
 * Format datetime based on user's preferred format
 *
 * @param date - Date string or Date object
 * @param timezone - User's timezone
 * @param dateFormat - User's preferred date format
 * @returns Formatted datetime string
 */
export function formatUserDateTime(
  date: string | Date,
  timezone: string = 'America/New_York',
  dateFormat: string = 'MM/dd/yyyy'
): string {
  const timeFormat = 'h:mm a';
  const fullFormat = `${dateFormat} ${timeFormat}`;

  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatInTimeZone(dateObj, timezone, fullFormat);
  } catch (error) {
    console.error('Error formatting user datetime:', error);
    return format(typeof date === 'string' ? parseISO(date) : date, fullFormat);
  }
}

/**
 * Get current time in user's timezone
 *
 * @param timezone - User's timezone
 * @returns Current date/time in user's timezone
 */
export function getCurrentTimeInTimezone(timezone: string = 'America/New_York'): Date {
  return toZonedTime(new Date(), timezone);
}

/**
 * Format a relative time (e.g., "2 hours ago") with timezone awareness
 *
 * @param date - Date string or Date object
 * @param timezone - User's timezone
 * @returns Relative time string (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(
  date: string | Date,
  timezone: string = 'America/New_York'
): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const zonedDate = toZonedTime(dateObj, timezone);
    const now = getCurrentTimeInTimezone(timezone);

    const diffMs = now.getTime() - zonedDate.getTime();
    const diffSec = Math.floor(Math.abs(diffMs) / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    const isPast = diffMs > 0;
    const suffix = isPast ? 'ago' : 'from now';

    if (diffSec < 60) return isPast ? 'just now' : 'in a moment';
    if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ${suffix}`;
    if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ${suffix}`;
    if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ${suffix}`;

    // For dates older than a week, show actual date
    return formatUserDate(dateObj, timezone);
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return 'Unknown';
  }
}

/**
 * Convert UTC date string to user's timezone
 *
 * @param utcDate - UTC date string (from API)
 * @param timezone - User's timezone
 * @returns Date object in user's timezone
 */
export function utcToTimezone(utcDate: string, timezone: string = 'America/New_York'): Date {
  return toZonedTime(parseISO(utcDate), timezone);
}

/**
 * Get timezone abbreviation (e.g., EST, PST)
 *
 * @param timezone - Timezone name (e.g., 'America/New_York')
 * @returns Timezone abbreviation
 */
export function getTimezoneAbbreviation(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });

    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find(part => part.type === 'timeZoneName');
    return tzPart?.value || '';
  } catch (error) {
    console.error('Error getting timezone abbreviation:', error);
    return '';
  }
}

/**
 * Get timezone offset (e.g., "-05:00" for EST)
 *
 * @param timezone - Timezone name
 * @returns Offset string
 */
export function getTimezoneOffset(timezone: string): string {
  try {
    const date = getCurrentTimeInTimezone(timezone);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset',
    });

    const parts = formatter.formatToParts(date);
    const offsetPart = parts.find(part => part.type === 'timeZoneName');
    return offsetPart?.value || '';
  } catch (error) {
    console.error('Error getting timezone offset:', error);
    return '';
  }
}
