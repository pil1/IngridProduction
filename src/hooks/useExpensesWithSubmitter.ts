import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Expense } from "@/types/expenses"; // Import the comprehensive Expense type

// Removed ExpenseWithSubmitter interface as it's now consolidated into Expense

export const useExpensesWithSubmitter = (companyId?: string) => {
  return useQuery({
    queryKey: ["expenses-with-submitter", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_expenses_with_submitter", {
        company_id_param: companyId || null,
      });

      if (error) {
        console.error("Error fetching expenses with submitter:", error);
        throw error;
      }

      return data as Expense[]; // Return as Expense[]
    },
  });
};