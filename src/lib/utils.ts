import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null | undefined, currencyCode: string = 'USD'): string {
  const numericAmount = amount ?? 0; // Default to 0 if null or undefined
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericAmount);
  } catch (error) {
    // Fallback for invalid currency codes
    return `${currencyCode} ${numericAmount.toFixed(2)}`;
  }
}

export async function getCurrencySymbol(currencyCode: string = 'USD'): Promise<string> {
  try {
    // Create a dummy formatter to extract the symbol
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    // Format a zero amount and extract the non-numeric part
    return formatter.format(0).replace(/0/g, '').trim();
  } catch (error) {
    console.error("Error getting currency symbol:", error);
    return currencyCode; // Fallback to code if symbol cannot be determined
  }
}

export function formatDate(date: string | Date): string {
  try {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    return 'Invalid Date';
  }
}

export function formatDateTime(date: string | Date): string {
  try {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    return 'Invalid Date';
  }
}

export function truncateText(text: React.ReactNode, maxLength: number): React.ReactNode {
  if (typeof text !== 'string') {
    return text; // Return non-string nodes as is
  }
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}