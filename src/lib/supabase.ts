import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Extract the actual error message from a supabase.functions.invoke() result.
 * FunctionsHttpError.message is always generic ("Edge Function returned a non-2xx status code");
 * the real error is in the unconsumed response body.
 */
export async function parseEdgeFunctionError(
  response: Response | undefined,
  fallback: string
): Promise<string> {
  if (!response) return fallback
  try {
    const body = await response.json()
    return body?.error || fallback
  } catch {
    return fallback
  }
}
