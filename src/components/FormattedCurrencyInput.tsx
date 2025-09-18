"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { formatCurrency, getCurrencySymbol } from "@/lib/utils";

type FormattedCurrencyInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  currencyCode: string;
};

const FormattedCurrencyInput = ({ value, onChange, disabled, currencyCode, ...props }: FormattedCurrencyInputProps) => {
  const [inputValue, setInputValue] = useState<string>('');
  const [symbol, setSymbol] = useState<string>('');
  const isInputFocused = useRef(false);

  useEffect(() => {
    getCurrencySymbol(currencyCode).then((s: string) => { // Explicitly type 's' as string
      setSymbol(s);
    });
  }, [currencyCode]);

  useEffect(() => {
    if (disabled) {
      const getFormatted = async () => {
        setInputValue(await formatCurrency(value, currencyCode));
      };
      getFormatted();
    } else if (!isInputFocused.current) {
      const getFormatted = async () => {
        setInputValue(await formatCurrency(value, currencyCode));
      };
      getFormatted();
    } else {
      setInputValue(value.toString());
    }
  }, [value, currencyCode, disabled]);

  const handleFocus = useCallback(async () => {
    isInputFocused.current = true;
    setInputValue(value.toString());
  }, [value]);

  const handleBlur = useCallback(async () => {
    isInputFocused.current = false;
    const parsedValue = parseFloat(inputValue);

    if (!isNaN(parsedValue)) {
      onChange(parsedValue);
      setInputValue(await formatCurrency(parsedValue, currencyCode));
    } else {
      onChange(0);
      setInputValue(await formatCurrency(0, currencyCode));
    }
  }, [inputValue, onChange, currencyCode]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  return (
    <div className="relative">
      {!disabled && isInputFocused.current && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {symbol}
        </span>
      )}
      <Input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        className={!disabled && isInputFocused.current ? "pl-8" : ""}
        {...props}
      />
    </div>
  );
};

export default FormattedCurrencyInput;