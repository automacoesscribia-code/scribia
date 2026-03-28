import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/register', '/auth/accept-invite', '/auth/set-password']

function getRedirectForRole(role: string): string {
  switch (role) {
    case 'super_admin': return '/admin'
    case 'organizer': return '/dashboard'
    case 'speaker': return '/speaker'
    default: return '/portal'
  }
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as never),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Helper: fetch user's primary role from profile
  async function getUserRole(): Promise<string | null> {
    if (!user) return null
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('roles')
      .eq('id', user.id)
      .single()
    const roles = (profile as { roles: string[] } | null)?.roles
    if (!roles || roles.length === 0) return null
    if (roles.includes('super_admin')) return 'super_admin'
    if (roles.includes('organizer')) return 'organizer'
    if (roles.includes('speaker')) return 'speaker'
    return 'participant'
  }

  // Public routes — allow access
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    if (user) {
      const role = await getUserRole()

      // If profile not found, stay on current page (avoid redirect loop)
      if (!role) {
        return supabaseResponse
      }

      return NextResponse.redirect(new URL(getRedirectForRole(role), request.url))
    }
    return supabaseResponse
  }

  // Protected routes — require auth
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Role-based route protection
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/portal') || pathname.startsWith('/admin') || pathname.startsWith('/speaker')) {
    const role = await getUserRole()

    if (!role) {
      // User authenticated but no profile — let them through instead of looping
      return supabaseResponse
    }

    // Super admin can access everything — no restrictions
    if (role === 'super_admin') {
      return supabaseResponse
    }

    // Organizer trying to access portal, admin, or speaker → redirect to dashboard
    if (role === 'organizer' && (pathname.startsWith('/portal') || pathname.startsWith('/admin') || pathname.startsWith('/speaker'))) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Speaker can only access /speaker — redirect everything else
    if (role === 'speaker' && !pathname.startsWith('/speaker')) {
      return NextResponse.redirect(new URL('/speaker', request.url))
    }

    // Participant trying to access dashboard, admin, or speaker → redirect to forbidden
    if (role === 'participant' && (pathname.startsWith('/dashboard') || pathname.startsWith('/admin') || pathname.startsWith('/speaker'))) {
      return NextResponse.redirect(new URL('/forbidden', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*', '/portal/:path*', '/admin/:path*', '/speaker/:path*', '/login', '/register'],
}
