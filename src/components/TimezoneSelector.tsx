/**
 * Timezone Selector Component
 *
 * Intelligent timezone selection with:
 * - Auto-detection from browser
 * - Searchable dropdown of all IANA timezones
 * - Grouped by continent/region
 * - Shows current time in selected timezone
 */

import React, { useMemo } from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GlobeIcon, ClockIcon } from '@/lib/icons';
import { formatInTimeZone } from 'date-fns-tz';

interface TimezoneSelectorProps {
  value?: string;
  onChange: (timezone: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

// Comprehensive list of IANA timezones grouped by region
const TIMEZONES = {
  'Americas': [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Phoenix',
    'America/Los_Angeles',
    'America/Anchorage',
    'America/Honolulu',
    'America/Toronto',
    'America/Vancouver',
    'America/Edmonton',
    'America/Winnipeg',
    'America/Halifax',
    'America/St_Johns',
    'America/Mexico_City',
    'America/Monterrey',
    'America/Sao_Paulo',
    'America/Rio_de_Janeiro',
    'America/Buenos_Aires',
    'America/Santiago',
    'America/Lima',
    'America/Bogota',
    'America/Caracas',
  ],
  'Europe': [
    'Europe/London',
    'Europe/Dublin',
    'Europe/Lisbon',
    'Europe/Paris',
    'Europe/Brussels',
    'Europe/Amsterdam',
    'Europe/Berlin',
    'Europe/Rome',
    'Europe/Madrid',
    'Europe/Vienna',
    'Europe/Zurich',
    'Europe/Prague',
    'Europe/Warsaw',
    'Europe/Athens',
    'Europe/Helsinki',
    'Europe/Stockholm',
    'Europe/Copenhagen',
    'Europe/Oslo',
    'Europe/Moscow',
    'Europe/Istanbul',
  ],
  'Asia': [
    'Asia/Dubai',
    'Asia/Riyadh',
    'Asia/Tehran',
    'Asia/Karachi',
    'Asia/Kolkata',
    'Asia/Kathmandu',
    'Asia/Dhaka',
    'Asia/Bangkok',
    'Asia/Singapore',
    'Asia/Hong_Kong',
    'Asia/Shanghai',
    'Asia/Beijing',
    'Asia/Taipei',
    'Asia/Seoul',
    'Asia/Tokyo',
    'Asia/Manila',
    'Asia/Jakarta',
  ],
  'Pacific': [
    'Pacific/Auckland',
    'Pacific/Fiji',
    'Pacific/Guam',
    'Pacific/Port_Moresby',
    'Pacific/Noumea',
    'Pacific/Guadalcanal',
    'Pacific/Honolulu',
  ],
  'Australia': [
    'Australia/Sydney',
    'Australia/Melbourne',
    'Australia/Brisbane',
    'Australia/Perth',
    'Australia/Adelaide',
    'Australia/Darwin',
    'Australia/Hobart',
  ],
  'Africa': [
    'Africa/Cairo',
    'Africa/Johannesburg',
    'Africa/Lagos',
    'Africa/Nairobi',
    'Africa/Casablanca',
    'Africa/Algiers',
    'Africa/Tunis',
  ],
  'Atlantic': [
    'Atlantic/Azores',
    'Atlantic/Cape_Verde',
    'Atlantic/Bermuda',
    'Atlantic/Reykjavik',
  ],
};

/**
 * Detect user's timezone from browser
 */
export const detectTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn('Failed to detect timezone:', error);
    return 'America/New_York';
  }
};

/**
 * Format timezone for display (e.g., "America/New_York" → "New York (EST)")
 */
const formatTimezoneLabel = (timezone: string): string => {
  try {
    const now = new Date();
    const cityName = timezone.split('/').pop()?.replace(/_/g, ' ') || timezone;

    // Get abbreviated timezone name (e.g., EST, PST)
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });

    const parts = formatter.formatToParts(now);
    const tzAbbr = parts.find(part => part.type === 'timeZoneName')?.value || '';

    // Get current time in this timezone
    const currentTime = formatInTimeZone(now, timezone, 'h:mm a');

    return `${cityName} (${tzAbbr}) - ${currentTime}`;
  } catch (error) {
    return timezone;
  }
};

export function TimezoneSelector({
  value,
  onChange,
  className,
  placeholder = 'Select timezone',
  disabled = false,
}: TimezoneSelectorProps) {
  // Detect browser timezone on mount
  const browserTimezone = useMemo(() => detectTimezone(), []);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <div className="flex items-center gap-2">
          <GlobeIcon className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder={placeholder} />
        </div>
      </SelectTrigger>
      <SelectContent>
        {/* Auto-detected timezone - only show if not already in main list */}
        {browserTimezone && !Object.values(TIMEZONES).flat().includes(browserTimezone) && (
          <SelectGroup>
            <SelectLabel className="flex items-center gap-2">
              <ClockIcon className="h-3 w-3" />
              Auto-Detected
            </SelectLabel>
            <SelectItem value={browserTimezone} key={`auto-detected`}>
              {formatTimezoneLabel(browserTimezone)} (Your Location)
            </SelectItem>
          </SelectGroup>
        )}

        {/* Grouped timezones by region */}
        {Object.entries(TIMEZONES).map(([region, timezones]) => (
          <SelectGroup key={region}>
            <SelectLabel>{region}</SelectLabel>
            {timezones.map((tz) => (
              <SelectItem key={`${region}-${tz}`} value={tz}>
                {formatTimezoneLabel(tz)}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Geo-locate timezone based on address
 * This is a simple heuristic - for production, use a geocoding API
 */
export const guessTimezoneFromAddress = (address: string): string => {
  const addressLower = address.toLowerCase();

  // US States
  if (addressLower.includes('new york') || addressLower.includes('ny')) return 'America/New_York';
  if (addressLower.includes('california') || addressLower.includes('ca') || addressLower.includes('los angeles')) return 'America/Los_Angeles';
  if (addressLower.includes('illinois') || addressLower.includes('chicago')) return 'America/Chicago';
  if (addressLower.includes('texas') || addressLower.includes('houston') || addressLower.includes('dallas')) return 'America/Chicago';
  if (addressLower.includes('florida') || addressLower.includes('miami')) return 'America/New_York';
  if (addressLower.includes('arizona') || addressLower.includes('phoenix')) return 'America/Phoenix';
  if (addressLower.includes('colorado') || addressLower.includes('denver')) return 'America/Denver';
  if (addressLower.includes('washington') || addressLower.includes('seattle')) return 'America/Los_Angeles';

  // Canada
  if (addressLower.includes('toronto') || addressLower.includes('ontario')) return 'America/Toronto';
  if (addressLower.includes('vancouver') || addressLower.includes('british columbia')) return 'America/Vancouver';
  if (addressLower.includes('montreal') || addressLower.includes('quebec')) return 'America/Toronto';
  if (addressLower.includes('calgary') || addressLower.includes('alberta')) return 'America/Edmonton';

  // UK/Europe
  if (addressLower.includes('london') || addressLower.includes('uk') || addressLower.includes('england')) return 'Europe/London';
  if (addressLower.includes('paris') || addressLower.includes('france')) return 'Europe/Paris';
  if (addressLower.includes('berlin') || addressLower.includes('germany')) return 'Europe/Berlin';
  if (addressLower.includes('rome') || addressLower.includes('italy')) return 'Europe/Rome';

  // Default fallback
  return detectTimezone();
};
