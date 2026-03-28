import { createClient } from '@supabase/supabase-js'
import type { Database } from '@scribia/supabase-client'

/**
 * Server-only Supabase client with service_role key.
 * Bypasses RLS — use ONLY in server components/actions for trusted operations.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY!,
  )
}
