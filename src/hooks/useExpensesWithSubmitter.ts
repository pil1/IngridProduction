import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Expense } from "@/types/expenses"; // Import the comprehensive Expense type

// Removed ExpenseWithSubmitter interface as it's now consolidated into Expense

export const useExpensesWithSubmitter = (companyId?: string) => {
  return useQuery({
    queryKey: ["expenses-with-submitter", companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase.rpc("get_expenses_with_submitter", {
        company_id_param: companyId,
      });

      if (error) {
        console.error("Error fetching expenses with submitter:", error);
        throw error;
      }

      return (data || []) as Expense[]; // Ensure we return an array
    },
    enabled: !!companyId,
    retry: 1,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};