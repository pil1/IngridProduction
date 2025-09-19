import { BaseApiService, ApiResponse } from './base';
import { supabase } from '@/integrations/supabase/client';

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
        const { data, error } = await supabase
          .from('user_table_preferences')
          .select('*')
          .eq('table_name', tableName)
          .single();

        // Return null if no preferences found (not an error)
        if (error && error.code === 'PGRST116') {
          return { data: null, error: null };
        }

        return { data, error };
      } catch (error) {
        // Gracefully handle if table doesn't exist
        if (error && typeof error === 'object' && 'message' in error) {
          const errorMessage = (error as { message: string }).message;
          if (errorMessage.includes('relation "user_table_preferences" does not exist')) {
            console.warn('User table preferences table not yet created. Returning null.');
            return { data: null, error: null };
          }
        }
        throw error;
      }
    });
  }

  /**
   * Save table preferences (upsert)
   */
  async saveTablePreferences(data: SaveTablePreferencesData): Promise<ApiResponse<TablePreferences>> {
    return this.handleRequest(async () => {
      try {
        const { data: result, error } = await supabase
          .from('user_table_preferences')
          .upsert({
            table_name: data.table_name,
            preferences: data.preferences,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        return { data: result, error };
      } catch (error) {
        // Gracefully handle if table doesn't exist
        if (error && typeof error === 'object' && 'message' in error) {
          const errorMessage = (error as { message: string }).message;
          if (errorMessage.includes('relation "user_table_preferences" does not exist')) {
            console.warn('User table preferences table not yet created. Preferences not saved.');
            return { data: null, error: { message: 'Table preferences not available' } };
          }
        }
        throw error;
      }
    });
  }

  /**
   * Delete table preferences
   */
  async deleteTablePreferences(tableName: string): Promise<ApiResponse<void>> {
    return this.handleRequest(async () => {
      try {
        const { error } = await supabase
          .from('user_table_preferences')
          .delete()
          .eq('table_name', tableName);

        return { data: undefined, error };
      } catch (error) {
        // Gracefully handle if table doesn't exist
        if (error && typeof error === 'object' && 'message' in error) {
          const errorMessage = (error as { message: string }).message;
          if (errorMessage.includes('relation "user_table_preferences" does not exist')) {
            console.warn('User table preferences table not yet created. Delete ignored.');
            return { data: undefined, error: null };
          }
        }
        throw error;
      }
    });
  }

  /**
   * Get all table preferences for current user
   */
  async getAllTablePreferences(): Promise<ApiResponse<TablePreferences[]>> {
    return this.handleRequest(async () => {
      try {
        const { data, error } = await supabase
          .from('user_table_preferences')
          .select('*')
          .order('table_name');

        return { data: data ?? [], error };
      } catch (error) {
        // Gracefully handle if table doesn't exist
        if (error && typeof error === 'object' && 'message' in error) {
          const errorMessage = (error as { message: string }).message;
          if (errorMessage.includes('relation "user_table_preferences" does not exist')) {
            console.warn('User table preferences table not yet created. Returning empty array.');
            return { data: [], error: null };
          }
        }
        throw error;
      }
    });
  }

  /**
   * Reset table preferences to defaults
   */
  async resetTablePreferences(tableName: string): Promise<ApiResponse<void>> {
    return this.handleRequest(async () => {
      try {
        const { error } = await supabase
          .from('user_table_preferences')
          .upsert({
            table_name: tableName,
            preferences: {}, // Empty preferences = defaults
            updated_at: new Date().toISOString()
          });

        return { data: undefined, error };
      } catch (error) {
        // Gracefully handle if table doesn't exist
        if (error && typeof error === 'object' && 'message' in error) {
          const errorMessage = (error as { message: string }).message;
          if (errorMessage.includes('relation "user_table_preferences" does not exist')) {
            console.warn('User table preferences table not yet created. Reset ignored.');
            return { data: undefined, error: null };
          }
        }
        throw error;
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