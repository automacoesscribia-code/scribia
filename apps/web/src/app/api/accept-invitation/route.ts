import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { token } = await request.json()
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    // Use admin client to bypass RLS
    const adminClient = createAdminClient()

    // Validate token exists, is pending, and not expired
    const { data: invitation, error: fetchError } = await adminClient
      .from('invitations')
      .select('id, email, status, expires_at')
      .eq('token', token)
      .single()

    if (fetchError || !invitation) {
      return NextResponse.json({ error: 'Convite nao encontrado' }, { status: 404 })
    }

    const inv = invitation as { id: string; email: string; status: string; expires_at: string }

    if (inv.status !== 'pending') {
      return NextResponse.json({ error: 'Convite ja foi utilizado' }, { status: 400 })
    }

    if (new Date(inv.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Convite expirado' }, { status: 400 })
    }

    // Accept the invitation
    const updatePayload: Record<string, unknown> = {
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    }
    const { error: updateError } = await adminClient
      .from('invitations')
      .update(updatePayload as never)
      .eq('token', token)
      .eq('status', 'pending')

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
