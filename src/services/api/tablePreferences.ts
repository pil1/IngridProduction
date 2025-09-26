import { BaseApiService, ApiResponse } from './base';
import { apiClient } from '@/integrations/api/client';

export interface TablePreferences {
  id: string;
  user_id: string;
  table_name: string;
  preferences: {
    columnWidths?: Record<string, number>;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    filters?: Record<string, any>;
    hiddenColumns?: string[];
    pageSize?: number;
    groupBy?: string | null;
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export interface SaveTablePreferencesData {
  table_name: string;
  preferences: Record<string, any>;
}

export class TablePreferencesService extends BaseApiService {
  /**
   * Get table preferences for a specific table
   */
  async getTablePreferences(tableName: string): Promise<ApiResponse<TablePreferences | null>> {
    return this.handleRequest(async () => {
      try {
        // Temporary localStorage implementation while backend endpoint is being developed
        const storageKey = `table_preferences_${tableName}`;
        const stored = localStorage.getItem(storageKey);

        if (!stored) {
          return { data: null, error: null };
        }

        const preferences = JSON.parse(stored);
        return {
          data: {
            id: tableName,
            user_id: 'local_user',
            table_name: tableName,
            preferences: preferences,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          error: null
        };
      } catch (error) {
        console.warn('Error reading table preferences from localStorage:', error);
        return { data: null, error: null };
      }
    });
  }

  /**
   * Save table preferences (upsert)
   */
  async saveTablePreferences(data: SaveTablePreferencesData): Promise<ApiResponse<TablePreferences>> {
    return this.handleRequest(async () => {
      try {
        // Temporary localStorage implementation while backend endpoint is being developed
        const storageKey = `table_preferences_${data.table_name}`;
        localStorage.setItem(storageKey, JSON.stringify(data.preferences));

        const result: TablePreferences = {
          id: data.table_name,
          user_id: 'local_user',
          table_name: data.table_name,
          preferences: data.preferences,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        return { data: result, error: null };
      } catch (error) {
        console.warn('Error saving table preferences to localStorage:', error);
        return { data: null, error: { message: 'Failed to save table preferences' } };
      }
    });
  }

  /**
   * Delete table preferences
   */
  async deleteTablePreferences(tableName: string): Promise<ApiResponse<void>> {
    return this.handleRequest(async () => {
      try {
        const storageKey = `table_preferences_${tableName}`;
        localStorage.removeItem(storageKey);
        return { data: undefined, error: null };
      } catch (error) {
        console.warn('Error deleting table preferences from localStorage:', error);
        return { data: undefined, error: null };
      }
    });
  }

  /**
   * Get all table preferences for current user
   */
  async getAllTablePreferences(): Promise<ApiResponse<TablePreferences[]>> {
    return this.handleRequest(async () => {
      try {
        const preferences: TablePreferences[] = [];
        const prefix = 'table_preferences_';

        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith(prefix)) {
            const tableName = key.substring(prefix.length);
            const stored = localStorage.getItem(key);
            if (stored) {
              const prefs = JSON.parse(stored);
              preferences.push({
                id: tableName,
                user_id: 'local_user',
                table_name: tableName,
                preferences: prefs,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
            }
          }
        }

        return { data: preferences.sort((a, b) => a.table_name.localeCompare(b.table_name)), error: null };
      } catch (error) {
        console.warn('Error reading all table preferences from localStorage:', error);
        return { data: [], error: null };
      }
    });
  }

  /**
   * Reset table preferences to defaults
   */
  async resetTablePreferences(tableName: string): Promise<ApiResponse<void>> {
    return this.handleRequest(async () => {
      try {
        const storageKey = `table_preferences_${tableName}`;
        localStorage.setItem(storageKey, JSON.stringify({})); // Empty preferences = defaults
        return { data: undefined, error: null };
      } catch (error) {
        console.warn('Error resetting table preferences in localStorage:', error);
        return { data: undefined, error: null };
      }
    });
  }

  /**
   * Helper method to get column width preferences
   */
  async getColumnWidths(tableName: string): Promise<Record<string, number>> {
    const { data } = await this.getTablePreferences(tableName);
    return data?.preferences?.columnWidths ?? {};
  }

  /**
   * Helper method to save just column widths
   */
  async saveColumnWidths(tableName: string, columnWidths: Record<string, number>): Promise<ApiResponse<TablePreferences>> {
    const { data: existing } = await this.getTablePreferences(tableName);
    const preferences = {
      ...existing?.preferences,
      columnWidths
    };

    return this.saveTablePreferences({ table_name: tableName, preferences });
  }

  /**
   * Helper method to get sort preferences
   */
  async getSortPreferences(tableName: string): Promise<{ sortBy?: string; sortDirection?: 'asc' | 'desc' }> {
    const { data } = await this.getTablePreferences(tableName);
    return {
      sortBy: data?.preferences?.sortBy,
      sortDirection: data?.preferences?.sortDirection
    };
  }

  /**
   * Helper method to save sort preferences
   */
  async saveSortPreferences(
    tableName: string,
    sortBy: string,
    sortDirection: 'asc' | 'desc'
  ): Promise<ApiResponse<TablePreferences>> {
    const { data: existing } = await this.getTablePreferences(tableName);
    const preferences = {
      ...existing?.preferences,
      sortBy,
      sortDirection
    };

    return this.saveTablePreferences({ table_name: tableName, preferences });
  }
}

// Export singleton instance
export const tablePreferencesService = new TablePreferencesService();