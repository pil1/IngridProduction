# Timezone System Documentation

## Overview

INFOtrac now has comprehensive timezone support that allows users to set their preferred timezone and date format. All dates and times throughout the application will be displayed in the user's timezone.

## Features

### ✨ **Auto-Detection**
- Automatically detects user's timezone from browser
- Suggests timezone based on company address
- Shows current time in selected timezone

### 🌍 **Comprehensive Timezone Support**
- 100+ IANA timezones covering all major cities worldwide
- Grouped by continent/region for easy navigation
- Shows timezone abbreviation (EST, PST, etc.) and current time

### 📅 **Date Format Preferences**
- MM/DD/YYYY (US format)
- DD/MM/YYYY (International format)
- YYYY-MM-DD (ISO format)
- All dates/times respect user's preference

### 🔄 **Real-Time Formatting**
- Absolute times ("04/29/2023 9:30 AM")
- Relative times ("2 hours ago", "in 3 days")
- Timezone-aware comparisons

## Components

### `TimezoneSelector`

Dropdown component for selecting timezones with auto-detection.

**Location**: `/src/components/TimezoneSelector.tsx`

**Usage**:
```tsx
import { TimezoneSelector } from '@/components/TimezoneSelector';

<TimezoneSelector
  value={timezone}
  onChange={setTimezone}
  placeholder="Auto-detect timezone"
/>
```

**Features**:
- Auto-detects browser timezone
- Shows current time in each timezone
- Searchable dropdown
- Grouped by region

### Utility Functions

**Location**: `/src/utils/timezone.ts`

```typescript
import {
  formatWithTimezone,
  formatUserDate,
  formatUserDateTime,
  formatRelativeTime,
  getCurrentTimeInTimezone,
  getTimezoneAbbreviation,
  DATE_FORMATS
} from '@/utils/timezone';

// Format with user's timezone
formatWithTimezone('2023-04-29T13:30:00Z', 'America/New_York', 'PPp');
// => "Apr 29, 2023, 9:30 AM"

// Format date only
formatUserDate('2023-04-29T13:30:00Z', 'America/New_York', 'MM/dd/yyyy');
// => "04/29/2023"

// Format datetime
formatUserDateTime('2023-04-29T13:30:00Z', 'America/New_York', 'MM/dd/yyyy');
// => "04/29/2023 9:30 AM"

// Relative time
formatRelativeTime('2023-04-29T13:30:00Z', 'America/New_York');
// => "2 hours ago"

// Get current time in timezone
const now = getCurrentTimeInTimezone('America/New_York');

// Get timezone abbreviation
const abbr = getTimezoneAbbreviation('America/New_York');
// => "EST" or "EDT" depending on daylight saving time
```

### React Hook

**Location**: `/src/hooks/useTimezone.ts`

```typescript
import { useTimezone } from '@/hooks/useTimezone';

function MyComponent() {
  const {
    timezone,         // "America/New_York"
    dateFormat,       // "MM/dd/yyyy"
    timezoneAbbr,     // "EST"
    formatDate,       // Format date only
    formatDateTime,   // Format date + time
    formatRelative,   // Relative time ("2 hours ago")
    format,           // Custom format
    getCurrentTime    // Current time in user's timezone
  } = useTimezone();

  // Use in JSX
  return (
    <div>
      <p>Created: {formatDateTime(expense.createdAt)}</p>
      <p>Last updated: {formatRelative(expense.updatedAt)}</p>
      <p>Timezone: {timezone} ({timezoneAbbr})</p>
    </div>
  );
}
```

## Database Schema

### Profiles Table

```sql
CREATE TABLE profiles (
  -- ... other columns
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  date_format VARCHAR(20) DEFAULT 'MM/dd/yyyy',
  -- ... other columns
);
```

### Companies Table

```sql
CREATE TABLE companies (
  -- ... other columns
  timezone VARCHAR(100) DEFAULT 'UTC',
  date_format VARCHAR(20) DEFAULT 'MM/dd/yyyy',
  -- ... other columns
);
```

## Usage Guide

### For Developers

**When displaying any date/time in the UI:**

1. **Use the `useTimezone` hook**:
```tsx
const { formatDateTime } = useTimezone();

return <span>{formatDateTime(expense.createdAt)}</span>;
```

2. **For relative times** (e.g., "2 hours ago"):
```tsx
const { formatRelative } = useTimezone();

return <span>{formatRelative(expense.updatedAt)}</span>;
```

3. **For date-only fields**:
```tsx
const { formatDate } = useTimezone();

return <span>{formatDate(invoice.dueDate)}</span>;
```

4. **For custom formats**:
```tsx
const { format } = useTimezone();

return <span>{format(expense.createdAt, 'MMMM d, yyyy')}</span>;
```

### For Users

**To set your timezone:**

1. Go to **Settings** → **Account Settings** tab
2. Under "Preferences", click the **Timezone** dropdown
3. Select your timezone (auto-detected timezone shown at top)
4. Click "Save Changes"

**To set date format:**

1. Same location as timezone
2. Choose from:
   - MM/DD/YYYY (US format) - e.g., 04/29/2023
   - DD/MM/YYYY (International) - e.g., 29/04/2023
   - YYYY-MM-DD (ISO) - e.g., 2023-04-29

**For admins editing users:**

1. Go to **User Management**
2. Expand a user row
3. Click "Edit User"
4. Set timezone and date format in the "Account Settings" section

## Auto-Detection Features

### Browser Detection
The system automatically detects the user's timezone from their browser using:
```typescript
Intl.DateTimeFormat().resolvedOptions().timeZone
```

### Address-Based Detection
When a company address is provided, the system can guess the timezone:
```typescript
import { guessTimezoneFromAddress } from '@/components/TimezoneSelector';

const timezone = guessTimezoneFromAddress(company.address);
```

**Supported locations**:
- US states (NY, CA, TX, FL, etc.)
- Canadian provinces
- Major international cities
- Fallback to browser detection

## Migration Notes

### Existing Data
- Default timezone: `America/New_York`
- Default date format: `MM/dd/yyyy`
- No migration needed - columns already exist in database

### Backward Compatibility
- All existing dates continue to work
- Users without timezone set will use default
- Fallback formatting if timezone operations fail

## Future Enhancements

### Planned Features
- [ ] Company-level timezone override for all users
- [ ] Timezone for recurring events/automations
- [ ] Timezone conversion warnings when collaborating across zones
- [ ] "Show in my timezone" toggle for shared views
- [ ] Meeting time coordinator (show time across multiple zones)

### Integration Points
- **Email notifications**: Send at appropriate time for user's timezone
- **Scheduled automations**: Run at user's local time
- **Reports**: Generate with timezone-specific date ranges
- **API responses**: Return dates in user's timezone

## Troubleshooting

### Issue: Dates showing in wrong timezone

**Solution**: Check that `useTimezone` hook is being used for all date displays.

### Issue: Timezone not saving

**Solution**: Verify the backend API endpoint `/users/:id/profile` is accepting timezone field.

### Issue: Format errors

**Solution**: Ensure `date-fns` and `date-fns-tz` packages are installed:
```bash
npm install date-fns date-fns-tz
```

## Testing

### Manual Testing
1. Set timezone to `America/Los_Angeles`
2. Create an expense
3. Verify created date shows Pacific time
4. Change timezone to `America/New_York`
5. Verify same date now shows Eastern time (3 hours later)

### Automated Testing
```typescript
import { formatWithTimezone } from '@/utils/timezone';

// Test timezone conversion
expect(formatWithTimezone('2023-04-29T13:30:00Z', 'America/New_York', 'h:mm a'))
  .toBe('9:30 AM');

expect(formatWithTimezone('2023-04-29T13:30:00Z', 'America/Los_Angeles', 'h:mm a'))
  .toBe('6:30 AM');
```

## Resources

- [IANA Time Zone Database](https://www.iana.org/time-zones)
- [date-fns documentation](https://date-fns.org/)
- [date-fns-tz documentation](https://github.com/marnusw/date-fns-tz)
- [Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)

---

**Last Updated**: September 30, 2025
**Version**: 1.0.0
