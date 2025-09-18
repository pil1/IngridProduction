"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";

interface FormattedCurrencyDisplayProps {
  amount: number | null | undefined;
  currencyCode: string;
}

const FormattedCurrencyDisplay = ({ amount, currencyCode }: FormattedCurrencyDisplayProps) => {
  const [formattedValue, setFormattedValue] = useState("...");

  useEffect(() => {
    const getFormatted = async () => {
      setFormattedValue(await formatCurrency(amount ?? 0, currencyCode)); // Provide default 0 for null/undefined
    };
    getFormatted();
  }, [amount, currencyCode]);

  return <>{formattedValue}</>;
};

export default FormattedCurrencyDisplay;