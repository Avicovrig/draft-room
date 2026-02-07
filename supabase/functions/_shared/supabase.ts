import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Create a Supabase admin client that bypasses RLS. */
export function createAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  )
}
