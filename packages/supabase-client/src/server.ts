import { createServerClient as createSSRClient } from '@supabase/ssr'
import type { CookieMethodsServer } from '@supabase/ssr'
import type { Database } from './database.types'

export function createServerClient(cookies: CookieMethodsServer) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createSSRClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies,
  })
}
