// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// Inlined crypto-utils functions
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM

async function getEncryptionKey(): Promise<CryptoKey> {
  // @ts-ignore
  const keyString = Deno.env.get('ENCRYPTION_KEY');
  if (!keyString) {
    throw new Error('ENCRYPTION_KEY environment variable not set');
  }
  
  const keyData = Uint8Array.from(atob(keyString), c => c.charCodeAt(0));
  
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: ALGORITHM },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encrypt(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

// End inlined crypto-utils functions

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: any) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key
    const supabase = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    // Verify user authentication
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    const { 
      company_id,
      sender_email, 
      smtp_host, 
      smtp_port, 
      smtp_username, 
      smtp_password, 
      email_api_key 
    } = await req.json()

    if (!company_id) {
      return new Response('Company ID is required', { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    // Check if user has permission to modify this company's settings
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return new Response('User profile not found', { 
        status: 404, 
        headers: corsHeaders 
      })
    }

    // User must be super-admin OR admin of the target company
    const canModify = profile.role === 'super-admin' || 
                     (profile.role === 'admin' && profile.company_id === company_id)

    if (!canModify) {
      return new Response('Forbidden: Insufficient permissions', { 
        status: 403, 
        headers: corsHeaders 
      })
    }

    // Prepare data for upsert
    const updateData: any = {
      company_id,
      sender_email,
      smtp_host,
      smtp_port,
      smtp_username,
    }

    // Encrypt sensitive data using proper encryption (not btoa!)
    if (smtp_password) {
      updateData.smtp_password_encrypted = await encrypt(smtp_password)
    }
    
    if (email_api_key) {
      updateData.email_api_key_encrypted = await encrypt(email_api_key)
    }

    // Upsert company SMTP settings
    const { data, error } = await supabase
      .from('company_smtp_settings')
      .upsert(updateData, { 
        onConflict: 'company_id',
        ignoreDuplicates: false 
      })
      .select()

    if (error) {
      console.error('Database error:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Function error:', error)
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})