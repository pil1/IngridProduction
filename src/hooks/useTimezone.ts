/**
 * useTimezone Hook
 *
 * React hook for accessing user's timezone preferences and formatting dates/times.
 * Automatically pulls timezone and date format from user's profile.
 */

import { useContext, useMemo } from 'react';
import { SessionContext } from '@/components/SessionContextProvider';
import {
  formatWithTimezone,
  formatUserDate,
  formatUserDateTime,
  formatRelativeTime,
  getCurrentTimeInTimezone,
  getTimezoneAbbreviation,
  DATE_FORMATS,
} from '@/utils/timezone';

export interface TimezoneFormatter {
  /**
   * User's timezone (e.g., 'America/New_York')
   */
  timezone: string;

  /**
   * User's preferred date format (e.g., 'MM/dd/yyyy')
   */
  dateFormat: string;

  /**
   * Timezone abbreviation (e.g., 'EST')
   */
  timezoneAbbr: string;

  /**
   * Format a date with user's timezone
   */
  formatDate: (date: string | Date) => string;

  /**
   * Format a datetime with user's timezone
   */
  formatDateTime: (date: string | Date) => string;

  /**
   * Format a relative time (e.g., "2 hours ago")
   */
  formatRelative: (date: string | Date) => string;

  /**
   * Format with custom format string
   */
  format: (date: string | Date, formatString: string) => string;

  /**
   * Get current time in user's timezone
   */
  getCurrentTime: () => Date;
}

/**
 * Hook to access timezone formatting functions with user's preferences
 *
 * @returns TimezoneFormatter object with timezone info and formatting functions
 *
 * @example
 * const { formatDate, formatDateTime, timezone } = useTimezone();
 *
 * // Format a date with user's timezone
 * const formattedDate = formatDate('2023-04-29T13:30:00Z');
 *
 * // Format a datetime
 * const formattedDateTime = formatDateTime('2023-04-29T13:30:00Z');
 *
 * // Relative time
 * const relativeTime = formatRelative('2023-04-29T13:30:00Z');
 */
export function useTimezone(): TimezoneFormatter {
  const sessionContext = useContext(SessionContext);

  // Get user's timezone and date format from profile
  const timezone = sessionContext?.profile?.timezone || 'America/New_York';
  const dateFormat = sessionContext?.profile?.dateFormat || 'MM/dd/yyyy';

  // Get timezone abbreviation
  const timezoneAbbr = useMemo(() => getTimezoneAbbreviation(timezone), [timezone]);

  return useMemo(() => ({
    timezone,
    dateFormat,
    timezoneAbbr,

    formatDate: (date: string | Date) => formatUserDate(date, timezone, dateFormat),

    formatDateTime: (date: string | Date) => formatUserDateTime(date, timezone, dateFormat),

    formatRelative: (date: string | Date) => formatRelativeTime(date, timezone),

    format: (date: string | Date, formatString: string) =>
      formatWithTimezone(date, timezone, formatString),

    getCurrentTime: () => getCurrentTimeInTimezone(timezone),
  }), [timezone, dateFormat, timezoneAbbr]);
}

/**
 * Hook to check if user has set a custom timezone
 *
 * @returns true if user has a custom timezone set
 */
export function useHasCustomTimezone(): boolean {
  const { timezone } = useTimezone();
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timezone !== browserTimezone;
}

/**
 * Export date format constants for use in components
 */
export { DATE_FORMATS };
