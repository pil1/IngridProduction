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

  // Fetch existing preferences
  const { data: preferences, isLoading: isLoadingPreferences } = useQuery<UserTablePreferences | null>({
    queryKey: ["userTablePreferences", userId, tableId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("user_table_preferences")
        .select("*")
        .eq("user_id", userId)
        .eq("table_id", tableId)
        .single();
      if (error && error.code !== 'PGRST116') { // PGRST116 means "no rows found"
        console.error(`Error fetching table preferences for ${tableId}:`, error);
        throw error;
      }
      return data;
    },
    enabled: !!userId && !isLoadingSession,
    staleTime: Infinity, // Preferences don't change often
  });

  // Initialize local state when preferences are loaded
  useEffect(() => {
    if (preferences?.column_widths) {
      setLocalColumnWidths(preferences.column_widths);
    } else {
      setLocalColumnWidths({}); // Reset if no preferences found
    }
  }, [preferences]);

  // Mutation to save preferences
  const savePreferencesMutation = useMutation({
    mutationFn: async (newWidths: ColumnWidths) => {
      if (!userId) throw new Error("User not authenticated.");

      const payload: UserTablePreferences = {
        user_id: userId,
        table_id: tableId,
        column_widths: newWidths,
      };

      const { data, error } = await supabase
        .from("user_table_preferences")
        .upsert(payload, { onConflict: "user_id, table_id" })
        .select()
        .single();

      if (error) {
        console.error(`Error saving table preferences for ${tableId}:`, error);
        throw error;
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["userTablePreferences", userId, tableId], data);
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