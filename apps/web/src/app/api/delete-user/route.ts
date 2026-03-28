import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  try {
    // Verify caller is super_admin
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('roles')
      .eq('id', user.id)
      .single()

    const roles = (profile as { roles: string[] } | null)?.roles ?? []
    if (!roles.includes('super_admin')) {
      return NextResponse.json({ error: 'Apenas super_admin pode deletar usuarios' }, { status: 403 })
    }

    const { userId } = await request.json()
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Prevent self-deletion
    if (userId === user.id) {
      return NextResponse.json({ error: 'Voce nao pode deletar sua propria conta' }, { status: 400 })
    }

    // Call the database function with service role
    const adminClient = createAdminClient()
    const { data, error } = await adminClient.rpc('delete_user_completely', {
      target_user_id: userId,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = data as { success?: boolean; error?: string; deleted_user?: string }
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
