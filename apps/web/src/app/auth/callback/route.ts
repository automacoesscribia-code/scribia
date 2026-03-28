import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // If a `next` param is provided (e.g., invite flow → set-password), use it
      if (next) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('roles')
          .eq('id', user.id)
          .single() as { data: { roles: string[] } | null }

        const roles = profile?.roles ?? []
        const redirectTo = roles.includes('super_admin') ? '/admin' : roles.includes('organizer') ? '/dashboard' : '/portal'
        return NextResponse.redirect(`${origin}${redirectTo}`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/login`)
}
