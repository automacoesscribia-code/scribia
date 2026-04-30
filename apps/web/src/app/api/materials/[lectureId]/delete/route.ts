import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

interface RouteParams {
  params: Promise<{ lectureId: string }>
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { lectureId } = await params
  const { searchParams } = new URL(request.url)
  const materialId = searchParams.get('id')
  const profile = searchParams.get('profile')

  // Verify user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()

  try {
    if (materialId) {
      // Delete a single material by ID
      await admin
        .from('lecture_materials')
        .delete()
        .eq('id', materialId)
        .eq('lecture_id', lectureId)

      return NextResponse.json({ success: true, deleted: 'single' })
    }

    if (profile) {
      // Delete all materials for a specific profile
      await admin
        .from('lecture_materials')
        .delete()
        .eq('lecture_id', lectureId)
        .eq('profile_type', profile)

      return NextResponse.json({ success: true, deleted: 'profile', profile })
    }

    // Delete ALL materials for this lecture
    await admin
      .from('lecture_materials')
      .delete()
      .eq('lecture_id', lectureId)

    return NextResponse.json({ success: true, deleted: 'all' })
  } catch (e) {
    console.error('Error deleting materials:', e)
    return NextResponse.json(
      { error: `Erro ao excluir: ${e instanceof Error ? e.message : e}` },
      { status: 500 },
    )
  }
}
