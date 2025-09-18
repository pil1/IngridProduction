// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    console.log('DEBUG: OPTIONS request received for check-company-duplicates');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const supabaseClient = createClient( // Use regular client for user auth
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized: No authenticated user.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authorization: Only admins, controllers, or super-admins can use this function
    const { data: currentProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, company_id')
      .eq('user_id', currentUser.id)
      .single();

    if (profileError || !currentProfile || !['admin', 'controller', 'super-admin'].includes(currentProfile.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden: Insufficient permissions to check company-wide duplicates.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { expense_id } = await req.json();

    if (!expense_id) {
      return new Response(JSON.stringify({ error: 'Missing expense_id.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Get the text_hash and company_id of the original expense's receipt
    const { data: originalReceiptData, error: originalReceiptError } = await supabaseAdmin
      .from('receipts')
      .select('text_hash, expenses(company_id)')
      .eq('expense_id', expense_id)
      .single();

    if (originalReceiptError || !originalReceiptData || !originalReceiptData.text_hash || !originalReceiptData.expenses) {
      console.warn(`No receipt or text_hash found for expense_id: ${expense_id}`);
      return new Response(JSON.stringify({ duplicates: [] }), { // No duplicates if no hash
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const originalTextHash = originalReceiptData.text_hash;
    const originalCompanyId = (originalReceiptData.expenses as { company_id: string }).company_id;

    // Ensure the current user is authorized for this company's data
    if (currentProfile.role !== 'super-admin' && currentProfile.company_id !== originalCompanyId) {
        return new Response(JSON.stringify({ error: 'Forbidden: You can only check duplicates for your own company.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // 2. Find other receipts in the same company with the same text_hash
    const { data: duplicateReceipts, error: duplicateReceiptsError } = await supabaseAdmin
      .from('receipts')
      .select(`
        id,
        file_url,
        file_name,
        uploaded_by,
        uploaded_at,
        expense_id,
        expenses (
          title,
          submitted_by,
          profiles (full_name, email)
        )
      `)
      .eq('text_hash', originalTextHash)
      .eq('expenses.company_id', originalCompanyId) // Filter by company_id from the joined expenses table
      .neq('expense_id', expense_id); // Exclude the original expense itself

    if (duplicateReceiptsError) {
      console.error('Error fetching duplicate receipts:', duplicateReceiptsError);
      throw duplicateReceiptsError;
    }

    // Format the output to be more consumable by the frontend
    const formattedDuplicates = (duplicateReceipts || []).map((receipt: any) => ({
      receipt_id: receipt.id,
      file_url: receipt.file_url,
      file_name: receipt.file_name,
      uploaded_by_user_id: receipt.uploaded_by,
      uploaded_at: receipt.uploaded_at,
      expense_id: receipt.expense_id,
      expense_title: receipt.expenses?.title || 'N/A',
      submitted_by_user_name: receipt.expenses?.profiles?.full_name || receipt.expenses?.profiles?.email || 'N/A',
    }));

    return new Response(JSON.stringify({ duplicates: formattedDuplicates }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in check-company-duplicates function:', (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});