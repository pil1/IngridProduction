/**
 * Country/State/Currency mapping data for company provisioning
 */

export interface Country {
  code: string;
  name: string;
  currency: string;
  states?: State[];
}

export interface State {
  code: string;
  name: string;
}

export const COUNTRIES: Country[] = [
  {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    states: [
      { code: 'AL', name: 'Alabama' },
      { code: 'AK', name: 'Alaska' },
      { code: 'AZ', name: 'Arizona' },
      { code: 'AR', name: 'Arkansas' },
      { code: 'CA', name: 'California' },
      { code: 'CO', name: 'Colorado' },
      { code: 'CT', name: 'Connecticut' },
      { code: 'DE', name: 'Delaware' },
      { code: 'FL', name: 'Florida' },
      { code: 'GA', name: 'Georgia' },
      { code: 'HI', name: 'Hawaii' },
      { code: 'ID', name: 'Idaho' },
      { code: 'IL', name: 'Illinois' },
      { code: 'IN', name: 'Indiana' },
      { code: 'IA', name: 'Iowa' },
      { code: 'KS', name: 'Kansas' },
      { code: 'KY', name: 'Kentucky' },
      { code: 'LA', name: 'Louisiana' },
      { code: 'ME', name: 'Maine' },
      { code: 'MD', name: 'Maryland' },
      { code: 'MA', name: 'Massachusetts' },
      { code: 'MI', name: 'Michigan' },
      { code: 'MN', name: 'Minnesota' },
      { code: 'MS', name: 'Mississippi' },
      { code: 'MO', name: 'Missouri' },
      { code: 'MT', name: 'Montana' },
      { code: 'NE', name: 'Nebraska' },
      { code: 'NV', name: 'Nevada' },
      { code: 'NH', name: 'New Hampshire' },
      { code: 'NJ', name: 'New Jersey' },
      { code: 'NM', name: 'New Mexico' },
      { code: 'NY', name: 'New York' },
      { code: 'NC', name: 'North Carolina' },
      { code: 'ND', name: 'North Dakota' },
      { code: 'OH', name: 'Ohio' },
      { code: 'OK', name: 'Oklahoma' },
      { code: 'OR', name: 'Oregon' },
      { code: 'PA', name: 'Pennsylvania' },
      { code: 'RI', name: 'Rhode Island' },
      { code: 'SC', name: 'South Carolina' },
      { code: 'SD', name: 'South Dakota' },
      { code: 'TN', name: 'Tennessee' },
      { code: 'TX', name: 'Texas' },
      { code: 'UT', name: 'Utah' },
      { code: 'VT', name: 'Vermont' },
      { code: 'VA', name: 'Virginia' },
      { code: 'WA', name: 'Washington' },
      { code: 'WV', name: 'West Virginia' },
      { code: 'WI', name: 'Wisconsin' },
      { code: 'WY', name: 'Wyoming' },
    ],
  },
  {
    code: 'CA',
    name: 'Canada',
    currency: 'CAD',
    states: [
      { code: 'AB', name: 'Alberta' },
      { code: 'BC', name: 'British Columbia' },
      { code: 'MB', name: 'Manitoba' },
      { code: 'NB', name: 'New Brunswick' },
      { code: 'NL', name: 'Newfoundland and Labrador' },
      { code: 'NS', name: 'Nova Scotia' },
      { code: 'ON', name: 'Ontario' },
      { code: 'PE', name: 'Prince Edward Island' },
      { code: 'QC', name: 'Quebec' },
      { code: 'SK', name: 'Saskatchewan' },
      { code: 'NT', name: 'Northwest Territories' },
      { code: 'NU', name: 'Nunavut' },
      { code: 'YT', name: 'Yukon' },
    ],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    currency: 'GBP',
    states: [
      { code: 'ENG', name: 'England' },
      { code: 'SCT', name: 'Scotland' },
      { code: 'WLS', name: 'Wales' },
      { code: 'NIR', name: 'Northern Ireland' },
    ],
  },
  {
    code: 'AU',
    name: 'Australia',
    currency: 'AUD',
    states: [
      { code: 'NSW', name: 'New South Wales' },
      { code: 'QLD', name: 'Queensland' },
      { code: 'SA', name: 'South Australia' },
      { code: 'TAS', name: 'Tasmania' },
      { code: 'VIC', name: 'Victoria' },
      { code: 'WA', name: 'Western Australia' },
      { code: 'ACT', name: 'Australian Capital Territory' },
      { code: 'NT', name: 'Northern Territory' },
    ],
  },
  // Eurozone countries
  {
    code: 'DE',
    name: 'Germany',
    currency: 'EUR',
    states: [
      { code: 'BW', name: 'Baden-Württemberg' },
      { code: 'BY', name: 'Bavaria' },
      { code: 'BE', name: 'Berlin' },
      { code: 'BB', name: 'Brandenburg' },
      { code: 'HB', name: 'Bremen' },
      { code: 'HH', name: 'Hamburg' },
      { code: 'HE', name: 'Hesse' },
      { code: 'MV', name: 'Mecklenburg-Vorpommern' },
      { code: 'NI', name: 'Lower Saxony' },
      { code: 'NW', name: 'North Rhine-Westphalia' },
      { code: 'RP', name: 'Rhineland-Palatinate' },
      { code: 'SL', name: 'Saarland' },
      { code: 'SN', name: 'Saxony' },
      { code: 'ST', name: 'Saxony-Anhalt' },
      { code: 'SH', name: 'Schleswig-Holstein' },
      { code: 'TH', name: 'Thuringia' },
    ],
  },
  {
    code: 'FR',
    name: 'France',
    currency: 'EUR',
  },
  {
    code: 'IT',
    name: 'Italy',
    currency: 'EUR',
  },
  {
    code: 'ES',
    name: 'Spain',
    currency: 'EUR',
  },
  {
    code: 'NL',
    name: 'Netherlands',
    currency: 'EUR',
  },
  {
    code: 'BE',
    name: 'Belgium',
    currency: 'EUR',
  },
  {
    code: 'AT',
    name: 'Austria',
    currency: 'EUR',
  },
  {
    code: 'PT',
    name: 'Portugal',
    currency: 'EUR',
  },
  {
    code: 'IE',
    name: 'Ireland',
    currency: 'EUR',
  },
  {
    code: 'FI',
    name: 'Finland',
    currency: 'EUR',
  },
  {
    code: 'GR',
    name: 'Greece',
    currency: 'EUR',
  },
  // Other major countries
  {
    code: 'JP',
    name: 'Japan',
    currency: 'JPY',
  },
  {
    code: 'KR',
    name: 'South Korea',
    currency: 'KRW',
  },
  {
    code: 'CN',
    name: 'China',
    currency: 'CNY',
  },
  {
    code: 'IN',
    name: 'India',
    currency: 'INR',
  },
  {
    code: 'BR',
    name: 'Brazil',
    currency: 'BRL',
  },
  {
    code: 'MX',
    name: 'Mexico',
    currency: 'MXN',
  },
  {
    code: 'ZA',
    name: 'South Africa',
    currency: 'ZAR',
  },
  {
    code: 'SG',
    name: 'Singapore',
    currency: 'SGD',
  },
  {
    code: 'CH',
    name: 'Switzerland',
    currency: 'CHF',
  },
  {
    code: 'NO',
    name: 'Norway',
    currency: 'NOK',
  },
  {
    code: 'SE',
    name: 'Sweden',
    currency: 'SEK',
  },
  {
    code: 'DK',
    name: 'Denmark',
    currency: 'DKK',
  },
  {
    code: 'NZ',
    name: 'New Zealand',
    currency: 'NZD',
  },
];

export const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
];

export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find(country => country.code === code);
}

export function getStatesByCountry(countryCode: string): State[] {
  const country = getCountryByCode(countryCode);
  return country?.states || [];
}

export function getCurrencyByCountry(countryCode: string): string {
  const country = getCountryByCode(countryCode);
  return country?.currency || 'USD';
}