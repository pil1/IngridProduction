import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InvitationWithDetails {
  id: string;
  company_id: string | null;
  email: string;
  role: string;
  invited_by: string | null;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string | null;
  first_name: string | null;
  last_name: string | null;
  // Company details
  company_name: string | null;
  // Inviter details
  inviter_email: string | null;
  inviter_first_name: string | null;
  inviter_last_name: string | null;
  inviter_full_name: string | null;
}

export const useInvitationsWithDetails = (companyId?: string) => {
  return useQuery({
    queryKey: ["invitations-with-details", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_invitations_with_details", {
        company_id_param: companyId ?? null,
      });

      if (error) {
        console.error("Error fetching invitations with details:", error);
        throw error;
      }

      return data as InvitationWithDetails[];
    },
  });
};