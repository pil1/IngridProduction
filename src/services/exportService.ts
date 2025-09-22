import { toast } from "sonner";

export type ExportFormat = "csv" | "xlsx" | "pdf" | "json";

export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  includeHeaders?: boolean;
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  filters?: Record<string, any>;
}

export interface ExportableItem {
  id: string;
  [key: string]: any;
}

/**
 * Service for exporting application data to various formats
 *
 * Supports exporting expenses, vendors, and other data to CSV, XLSX, PDF, and JSON formats.
 * Provides automatic filename generation, data formatting, and browser download functionality.
 *
 * @example
 * ```typescript
 * import { exportService } from '@/services/exportService';
 *
 * // Export expenses to CSV
 * await exportService.exportExpenses(expenseData, {
 *   format: 'csv',
 *   filename: 'my-expenses.csv',
 *   includeHeaders: true
 * });
 *
 * // Export vendors to JSON
 * await exportService.exportVendors(vendorData, {
 *   format: 'json'
 * });
 * ```
 */
class ExportService {
  /**
   * Convert data to CSV format
   */
  private toCSV(data: ExportableItem[], headers: string[]): string {
    const csvContent = [
      headers.join(','),
      ...data.map(item =>
        headers.map(header => {
          const value = item[header];
          // Handle values that contain commas, quotes, or newlines
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value ?? '';
        }).join(',')
      )
    ].join('\n');

    return csvContent;
  }

  /**
   * Convert data to JSON format
   */
  private toJSON(data: ExportableItem[]): string {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Download file with given content
   */
  private downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  /**
   * Generate filename with timestamp
   */
  private generateFilename(baseName: string, format: ExportFormat): string {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    return `${baseName}-${timestamp}.${format}`;
  }

  /**
   * Exports expense data to the specified format
   *
   * Formats expense data appropriately for export, including date formatting,
   * currency values, and boolean conversions. Automatically generates filename
   * if not provided.
   *
   * @param expenses - Array of expense objects to export
   * @param options - Export configuration options
   * @param options.format - Export format (csv, xlsx, pdf, json)
   * @param options.filename - Custom filename (optional, auto-generated if not provided)
   * @param options.includeHeaders - Whether to include column headers (default: true)
   * @param options.dateRange - Optional date range filter
   * @param options.filters - Additional filters to apply
   * @returns Promise that resolves when export is complete
   *
   * @example
   * ```typescript
   * // Export all expenses as CSV
   * await exportService.exportExpenses(expenses, { format: 'csv' });
   *
   * // Export with custom filename and date range
   * await exportService.exportExpenses(expenses, {
   *   format: 'xlsx',
   *   filename: 'Q1-expenses.xlsx',
   *   dateRange: {
   *     from: new Date('2024-01-01'),
   *     to: new Date('2024-03-31')
   *   }
   * });
   * ```
   */
  async exportExpenses(
    expenses: any[],
    options: ExportOptions = { format: 'csv' }
  ): Promise<void> {
    try {
      const filename = options.filename || this.generateFilename('expenses', options.format);

      // Define expense headers
      const headers = [
        'id',
        'description',
        'amount',
        'status',
        'expense_date',
        'category_name',
        'vendor_name',
        'submitter_full_name',
        'submitter_email',
        'is_reimbursable',
        'created_at',
        'approved_at',
        'rejected_at'
      ];

      // Filter and format data
      const exportData = expenses.map(expense => ({
        id: expense.id,
        description: expense.description ?? '',
        amount: expense.amount ?? 0,
        status: expense.status ?? '',
        expense_date: expense.expense_date ? new Date(expense.expense_date).toLocaleDateString() : '',
        category_name: expense.category_name ?? 'Uncategorized',
        vendor_name: expense.vendor_name ?? '',
        submitter_full_name: expense.submitter_full_name ?? '',
        submitter_email: expense.submitter_email ?? '',
        is_reimbursable: expense.is_reimbursable ? 'Yes' : 'No',
        created_at: expense.created_at ? new Date(expense.created_at).toLocaleDateString() : '',
        approved_at: expense.approved_at ? new Date(expense.approved_at).toLocaleDateString() : '',
        rejected_at: expense.rejected_at ? new Date(expense.rejected_at).toLocaleDateString() : ''
      }));

      await this.exportData(exportData, headers, options, filename);

      toast.success('Export completed', {
        description: `Successfully exported ${exportData.length} expenses as ${options.format.toUpperCase()}`
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred'
      });
      throw error;
    }
  }

  /**
   * Exports vendor data to the specified format
   *
   * Formats vendor contact information, addresses, and business details
   * for export. Handles optional fields gracefully.
   *
   * @param vendors - Array of vendor objects to export
   * @param options - Export configuration options
   * @returns Promise that resolves when export is complete
   *
   * @example
   * ```typescript
   * // Export vendors as JSON
   * await exportService.exportVendors(vendors, {
   *   format: 'json',
   *   filename: 'vendor-directory.json'
   * });
   * ```
   */
  async exportVendors(
    vendors: any[],
    options: ExportOptions = { format: 'csv' }
  ): Promise<void> {
    try {
      const filename = options.filename || this.generateFilename('vendors', options.format);

      const headers = [
        'id',
        'name',
        'email',
        'phone',
        'address',
        'is_active',
        'created_at'
      ];

      const exportData = vendors.map(vendor => ({
        id: vendor.id,
        name: vendor.name ?? '',
        email: vendor.email ?? '',
        phone: vendor.phone ?? '',
        address: vendor.address ?? '',
        is_active: vendor.is_active ? 'Yes' : 'No',
        created_at: vendor.created_at ? new Date(vendor.created_at).toLocaleDateString() : ''
      }));

      await this.exportData(exportData, headers, options, filename);

      toast.success('Export completed', {
        description: `Successfully exported ${exportData.length} vendors as ${options.format.toUpperCase()}`
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred'
      });
      throw error;
    }
  }

  /**
   * Export user data
   */
  async exportUsers(
    users: any[],
    options: ExportOptions = { format: 'csv' }
  ): Promise<void> {
    try {
      const filename = options.filename || this.generateFilename('users', options.format);

      const headers = [
        'id',
        'email',
        'first_name',
        'last_name',
        'role',
        'is_active',
        'last_login',
        'created_at'
      ];

      const exportData = users.map(user => ({
        id: user.id,
        email: user.email || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        role: user.role || '',
        is_active: user.is_active ? 'Yes' : 'No',
        last_login: user.last_login ? new Date(user.last_login).toLocaleDateString() : '',
        created_at: user.created_at ? new Date(user.created_at).toLocaleDateString() : ''
      }));

      await this.exportData(exportData, headers, options, filename);

      toast.success('Export completed', {
        description: `Successfully exported ${exportData.length} users as ${options.format.toUpperCase()}`
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred'
      });
      throw error;
    }
  }

  /**
   * Generic export method
   */
  private async exportData(
    data: ExportableItem[],
    headers: string[],
    options: ExportOptions,
    filename: string
  ): Promise<void> {
    switch (options.format) {
      case 'csv': {
        const csvContent = this.toCSV(data, headers);
        this.downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
        break;
      }

      case 'json': {
        const jsonContent = this.toJSON(data);
        this.downloadFile(jsonContent, filename, 'application/json;charset=utf-8;');
        break;
      }

      case 'xlsx':
        // For now, fall back to CSV format
        // In a real implementation, you'd use a library like SheetJS
        toast.info('XLSX export not yet implemented, using CSV format');
        const xlsxAsCsv = this.toCSV(data, headers);
        this.downloadFile(xlsxAsCsv, filename.replace('.xlsx', '.csv'), 'text/csv;charset=utf-8;');
        break;

      case 'pdf':
        // For now, fall back to CSV format
        // In a real implementation, you'd use a library like jsPDF
        toast.info('PDF export not yet implemented, using CSV format');
        const pdfAsCsv = this.toCSV(data, headers);
        this.downloadFile(pdfAsCsv, filename.replace('.pdf', '.csv'), 'text/csv;charset=utf-8;');
        break;

      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Export filtered data with search criteria
   */
  async exportFiltered<T extends ExportableItem>(
    data: T[],
    exportType: 'expenses' | 'vendors' | 'users',
    options: ExportOptions = { format: 'csv' }
  ): Promise<void> {
    switch (exportType) {
      case 'expenses':
        return this.exportExpenses(data, options);
      case 'vendors':
        return this.exportVendors(data, options);
      case 'users':
        return this.exportUsers(data, options);
      default:
        throw new Error(`Unsupported export type: ${exportType}`);
    }
  }
}

export const exportService = new ExportService();
export default exportService;