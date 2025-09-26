/**
 * Address Form Components
 *
 * Reusable components for handling address input with country/state dropdowns.
 */

import React, { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  COUNTRIES,
  CURRENCIES,
  getStatesProvinces,
  getCountryCurrency,
  validatePostalCode,
  type Country,
  type StateProvince,
  type Currency,
} from '@/lib/address-utils';

interface AddressFormProps {
  values: {
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  onChange: (field: string, value: string) => void;
  errors?: Record<string, string>;
  required?: boolean;
  className?: string;
}

export const AddressForm: React.FC<AddressFormProps> = ({
  values,
  onChange,
  errors = {},
  required = false,
  className = '',
}) => {
  const statesProvinces = useMemo(() => {
    return values.country ? getStatesProvinces(values.country) : [];
  }, [values.country]);

  const hasStatesProvinces = statesProvinces.length > 0;

  const getStateLabel = (countryCode?: string) => {
    switch (countryCode) {
      case 'CA':
        return 'Province';
      case 'US':
        return 'State';
      default:
        return 'State/Province';
    }
  };

  const getPostalCodeLabel = (countryCode?: string) => {
    switch (countryCode) {
      case 'US':
        return 'ZIP Code';
      case 'CA':
      case 'GB':
        return 'Postal Code';
      default:
        return 'Postal/ZIP Code';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Address Line 1 */}
      <div className="space-y-2">
        <Label htmlFor="address_line1">
          Street Address {required && '*'}
        </Label>
        <Input
          id="address_line1"
          value={values.address_line1 || ''}
          onChange={(e) => onChange('address_line1', e.target.value)}
          placeholder="123 Main Street"
        />
        {errors.address_line1 && (
          <p className="text-sm text-red-600">{errors.address_line1}</p>
        )}
      </div>

      {/* Address Line 2 */}
      <div className="space-y-2">
        <Label htmlFor="address_line2">
          Apartment, suite, etc. (optional)
        </Label>
        <Input
          id="address_line2"
          value={values.address_line2 || ''}
          onChange={(e) => onChange('address_line2', e.target.value)}
          placeholder="Suite 100"
        />
        {errors.address_line2 && (
          <p className="text-sm text-red-600">{errors.address_line2}</p>
        )}
      </div>

      {/* Country */}
      <div className="space-y-2">
        <Label htmlFor="country">
          Country {required && '*'}
        </Label>
        <Select
          value={values.country || ''}
          onValueChange={(value) => {
            onChange('country', value);
            // Clear state when country changes
            if (values.state) {
              onChange('state', '');
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a country" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                {country.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.country && (
          <p className="text-sm text-red-600">{errors.country}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* City */}
        <div className="space-y-2">
          <Label htmlFor="city">
            City {required && '*'}
          </Label>
          <Input
            id="city"
            value={values.city || ''}
            onChange={(e) => onChange('city', e.target.value)}
            placeholder="City"
          />
          {errors.city && (
            <p className="text-sm text-red-600">{errors.city}</p>
          )}
        </div>

        {/* State/Province */}
        <div className="space-y-2">
          <Label htmlFor="state">
            {getStateLabel(values.country)} {required && '*'}
          </Label>
          {hasStatesProvinces ? (
            <Select
              value={values.state || ''}
              onValueChange={(value) => onChange('state', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={`Select ${getStateLabel(values.country).toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {statesProvinces.map((state) => (
                  <SelectItem key={state.code} value={state.code}>
                    {state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="state"
              value={values.state || ''}
              onChange={(e) => onChange('state', e.target.value)}
              placeholder={getStateLabel(values.country)}
            />
          )}
          {errors.state && (
            <p className="text-sm text-red-600">{errors.state}</p>
          )}
        </div>

        {/* Postal Code */}
        <div className="space-y-2">
          <Label htmlFor="postal_code">
            {getPostalCodeLabel(values.country)} {required && '*'}
          </Label>
          <Input
            id="postal_code"
            value={values.postal_code || ''}
            onChange={(e) => onChange('postal_code', e.target.value)}
            placeholder={values.country === 'US' ? '12345' : values.country === 'CA' ? 'A1A 1A1' : 'Postal code'}
          />
          {errors.postal_code && (
            <p className="text-sm text-red-600">{errors.postal_code}</p>
          )}
        </div>
      </div>
    </div>
  );
};

interface CountrySelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
}

export const CountrySelect: React.FC<CountrySelectProps> = ({
  value,
  onChange,
  placeholder = "Select a country",
  required = false,
  error,
}) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="country">
        Country {required && '*'}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {COUNTRIES.map((country) => (
            <SelectItem key={country.code} value={country.code}>
              {country.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

interface CurrencySelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
}

export const CurrencySelect: React.FC<CurrencySelectProps> = ({
  value,
  onChange,
  placeholder = "Select a currency",
  required = false,
  error,
}) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="currency">
        Base Currency {required && '*'}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {CURRENCIES.map((currency) => (
            <SelectItem key={currency.code} value={currency.code}>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{currency.symbol}</span>
                <span>{currency.name} ({currency.code})</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};