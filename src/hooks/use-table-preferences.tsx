"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";

interface ColumnWidths {
  [columnKey: string]: number; // Stores width in pixels
}

interface UserTablePreferences {
  id?: string; // Optional for new preferences
  user_id: string;
  table_id: string;
  column_widths: ColumnWidths;
}

export function useTablePreferences(tableId: string) {
  const queryClient = useQueryClient();
  const { user, isLoading: isLoadingSession } = useSession();
  const userId = user?.id;

  // State for local column widths, initialized from query data
  const [localColumnWidths, setLocalColumnWidths] = useState<ColumnWidths>({});

  // Fetch existing preferences with graceful error handling
  const { data: preferences, isLoading: isLoadingPreferences } = useQuery<UserTablePreferences | null>({
    queryKey: ["userTablePreferences", userId, tableId],
    queryFn: async () => {
      if (!userId) return null;
      try {
        const { data, error } = await supabase
          .from("user_table_preferences")
          .select("*")
          .eq("user_id", userId)
          .eq("table_id", tableId)
          .single();

        if (error) {
          // Handle "no rows found" gracefully
          if (error.code === 'PGRST116') {
            return null; // No preferences found, return null
          }
          // Handle table doesn't exist error
          if (error.message?.includes('relation "public.user_table_preferences" does not exist') ||
              error.code === '42P01') {
            console.warn('User table preferences table not found, using defaults');
            return null;
          }
          throw error;
        }
        return data;
      } catch (error: any) {
        // Handle network or other errors gracefully
        if (error.message?.includes('404') || error.message?.includes('relation') || error.code === '42P01') {
          console.warn('User table preferences not available, using defaults:', error);
          return null;
        }
        throw error;
      }
    },
    enabled: !!userId && !isLoadingSession,
    staleTime: Infinity, // Preferences don't change often
    retry: false, // Don't retry if table doesn't exist
  });

  // Initialize local state when preferences are loaded
  useEffect(() => {
    if (preferences?.column_widths) {
      setLocalColumnWidths(preferences.column_widths);
    } else {
      setLocalColumnWidths({}); // Reset if no preferences found
    }
  }, [preferences]);

  // Mutation to save preferences with error handling
  const savePreferencesMutation = useMutation({
    mutationFn: async (newWidths: ColumnWidths) => {
      if (!userId) throw new Error("User not authenticated.");

      const payload: UserTablePreferences = {
        user_id: userId,
        table_id: tableId,
        column_widths: newWidths,
      };

      try {
        const { data, error } = await supabase
          .from("user_table_preferences")
          .upsert(payload, { onConflict: "user_id, table_id" })
          .select()
          .single();

        if (error) {
          // Handle table doesn't exist error silently
          if (error.message?.includes('relation "public.user_table_preferences" does not exist') ||
              error.code === '42P01') {
            console.warn('Cannot save table preferences - table not available');
            return null;
          }
          throw error;
        }
        return data;
      } catch (error: any) {
        // Handle network or other errors gracefully
        if (error.message?.includes('404') || error.message?.includes('relation') || error.code === '42P01') {
          console.warn('Cannot save table preferences - table not available:', error);
          return null;
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.setQueryData(["userTablePreferences", userId, tableId], data);
      }
    },
    onError: (error: any) => {
      // Silently handle table not found errors
      if (!error.message?.includes('404') && !error.message?.includes('relation')) {
        console.error(`Error saving table preferences for ${tableId}:`, error);
      }
    },
  });

  // Callback to update a single column's width
  const updateColumnWidth = useCallback((columnKey: string, width: number) => {
    setLocalColumnWidths(prev => {
      const newWidths = { ...prev, [columnKey]: width };
      // Debounce saving to Supabase to avoid too many writes
      // In a real app, you'd use a proper debounce utility
      const timeoutId = setTimeout(() => {
        savePreferencesMutation.mutate(newWidths);
      }, 500); // Save after 500ms of no further changes

      // Clear previous timeout if a new update comes in quickly
      // (This simple implementation doesn't handle multiple concurrent debounces perfectly,
      // a dedicated debounce utility would be better for production)
      clearTimeout((window as any)[`debounce-${tableId}-${columnKey}`]);
      (window as any)[`debounce-${tableId}-${columnKey}`] = timeoutId;

      return newWidths;
    });
  }, [savePreferencesMutation, tableId]);

  const isLoading = isLoadingSession || isLoadingPreferences;

  return {
    columnWidths: localColumnWidths,
    updateColumnWidth,
    isLoading,
    isSaving: savePreferencesMutation.isPending,
  };
}