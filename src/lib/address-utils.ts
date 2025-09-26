/**
 * Address Utilities
 *
 * Comprehensive utilities for handling countries, states/provinces,
 * currencies, and address formatting across the application.
 */

export interface Country {
  code: string;
  name: string;
  currency: string;
  phoneCode: string;
}

export interface StateProvince {
  code: string;
  name: string;
  country: string;
}

export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

// Major countries with their currencies
export const COUNTRIES: Country[] = [
  { code: 'US', name: 'United States', currency: 'USD', phoneCode: '+1' },
  { code: 'CA', name: 'Canada', currency: 'CAD', phoneCode: '+1' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', phoneCode: '+44' },
  { code: 'AU', name: 'Australia', currency: 'AUD', phoneCode: '+61' },
  { code: 'DE', name: 'Germany', currency: 'EUR', phoneCode: '+49' },
  { code: 'FR', name: 'France', currency: 'EUR', phoneCode: '+33' },
  { code: 'IT', name: 'Italy', currency: 'EUR', phoneCode: '+39' },
  { code: 'ES', name: 'Spain', currency: 'EUR', phoneCode: '+34' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', phoneCode: '+31' },
  { code: 'JP', name: 'Japan', currency: 'JPY', phoneCode: '+81' },
  { code: 'CN', name: 'China', currency: 'CNY', phoneCode: '+86' },
  { code: 'IN', name: 'India', currency: 'INR', phoneCode: '+91' },
  { code: 'BR', name: 'Brazil', currency: 'BRL', phoneCode: '+55' },
  { code: 'MX', name: 'Mexico', currency: 'MXN', phoneCode: '+52' },
].sort((a, b) => a.name.localeCompare(b.name));

// US States
export const US_STATES: StateProvince[] = [
  { code: 'AL', name: 'Alabama', country: 'US' },
  { code: 'AK', name: 'Alaska', country: 'US' },
  { code: 'AZ', name: 'Arizona', country: 'US' },
  { code: 'AR', name: 'Arkansas', country: 'US' },
  { code: 'CA', name: 'California', country: 'US' },
  { code: 'CO', name: 'Colorado', country: 'US' },
  { code: 'CT', name: 'Connecticut', country: 'US' },
  { code: 'DE', name: 'Delaware', country: 'US' },
  { code: 'FL', name: 'Florida', country: 'US' },
  { code: 'GA', name: 'Georgia', country: 'US' },
  { code: 'HI', name: 'Hawaii', country: 'US' },
  { code: 'ID', name: 'Idaho', country: 'US' },
  { code: 'IL', name: 'Illinois', country: 'US' },
  { code: 'IN', name: 'Indiana', country: 'US' },
  { code: 'IA', name: 'Iowa', country: 'US' },
  { code: 'KS', name: 'Kansas', country: 'US' },
  { code: 'KY', name: 'Kentucky', country: 'US' },
  { code: 'LA', name: 'Louisiana', country: 'US' },
  { code: 'ME', name: 'Maine', country: 'US' },
  { code: 'MD', name: 'Maryland', country: 'US' },
  { code: 'MA', name: 'Massachusetts', country: 'US' },
  { code: 'MI', name: 'Michigan', country: 'US' },
  { code: 'MN', name: 'Minnesota', country: 'US' },
  { code: 'MS', name: 'Mississippi', country: 'US' },
  { code: 'MO', name: 'Missouri', country: 'US' },
  { code: 'MT', name: 'Montana', country: 'US' },
  { code: 'NE', name: 'Nebraska', country: 'US' },
  { code: 'NV', name: 'Nevada', country: 'US' },
  { code: 'NH', name: 'New Hampshire', country: 'US' },
  { code: 'NJ', name: 'New Jersey', country: 'US' },
  { code: 'NM', name: 'New Mexico', country: 'US' },
  { code: 'NY', name: 'New York', country: 'US' },
  { code: 'NC', name: 'North Carolina', country: 'US' },
  { code: 'ND', name: 'North Dakota', country: 'US' },
  { code: 'OH', name: 'Ohio', country: 'US' },
  { code: 'OK', name: 'Oklahoma', country: 'US' },
  { code: 'OR', name: 'Oregon', country: 'US' },
  { code: 'PA', name: 'Pennsylvania', country: 'US' },
  { code: 'RI', name: 'Rhode Island', country: 'US' },
  { code: 'SC', name: 'South Carolina', country: 'US' },
  { code: 'SD', name: 'South Dakota', country: 'US' },
  { code: 'TN', name: 'Tennessee', country: 'US' },
  { code: 'TX', name: 'Texas', country: 'US' },
  { code: 'UT', name: 'Utah', country: 'US' },
  { code: 'VT', name: 'Vermont', country: 'US' },
  { code: 'VA', name: 'Virginia', country: 'US' },
  { code: 'WA', name: 'Washington', country: 'US' },
  { code: 'WV', name: 'West Virginia', country: 'US' },
  { code: 'WI', name: 'Wisconsin', country: 'US' },
  { code: 'WY', name: 'Wyoming', country: 'US' },
].sort((a, b) => a.name.localeCompare(b.name));

// Canadian Provinces and Territories
export const CANADIAN_PROVINCES: StateProvince[] = [
  { code: 'AB', name: 'Alberta', country: 'CA' },
  { code: 'BC', name: 'British Columbia', country: 'CA' },
  { code: 'MB', name: 'Manitoba', country: 'CA' },
  { code: 'NB', name: 'New Brunswick', country: 'CA' },
  { code: 'NL', name: 'Newfoundland and Labrador', country: 'CA' },
  { code: 'NS', name: 'Nova Scotia', country: 'CA' },
  { code: 'ON', name: 'Ontario', country: 'CA' },
  { code: 'PE', name: 'Prince Edward Island', country: 'CA' },
  { code: 'QC', name: 'Quebec', country: 'CA' },
  { code: 'SK', name: 'Saskatchewan', country: 'CA' },
  { code: 'NT', name: 'Northwest Territories', country: 'CA' },
  { code: 'NU', name: 'Nunavut', country: 'CA' },
  { code: 'YT', name: 'Yukon', country: 'CA' },
].sort((a, b) => a.name.localeCompare(b.name));

// Common currencies
export const CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
].sort((a, b) => a.name.localeCompare(b.name));

/**
 * Get states/provinces for a specific country
 */
export const getStatesProvinces = (countryCode: string): StateProvince[] => {
  switch (countryCode) {
    case 'US':
      return US_STATES;
    case 'CA':
      return CANADIAN_PROVINCES;
    default:
      return [];
  }
};

/**
 * Get default currency for a country
 */
export const getCountryCurrency = (countryCode: string): string => {
  const country = COUNTRIES.find(c => c.code === countryCode);
  return country?.currency || 'USD';
};

/**
 * Generate a URL-friendly slug from company name
 */
export const generateCompanySlug = (companyName: string): string => {
  return companyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
};

/**
 * Format address for display
 */
export const formatAddress = (address: {
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}): string => {
  const parts = [];

  if (address.address_line1) {
    parts.push(address.address_line1);
  }

  if (address.address_line2) {
    parts.push(address.address_line2);
  }

  const cityStateZip = [
    address.city,
    address.state,
    address.postal_code
  ].filter(Boolean).join(', ');

  if (cityStateZip) {
    parts.push(cityStateZip);
  }

  if (address.country && address.country !== 'US') {
    const country = COUNTRIES.find(c => c.code === address.country);
    if (country) {
      parts.push(country.name);
    }
  }

  return parts.join('\n');
};

/**
 * Validate postal code format based on country
 */
export const validatePostalCode = (postalCode: string, countryCode: string): boolean => {
  switch (countryCode) {
    case 'US':
      return /^\d{5}(-\d{4})?$/.test(postalCode);
    case 'CA':
      return /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/.test(postalCode);
    case 'GB':
      return /^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/.test(postalCode);
    default:
      return postalCode.length > 0; // Basic validation for other countries
  }
};