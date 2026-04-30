import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

interface RouteParams {
  params: Promise<{ lectureId: string }>
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { lectureId } = await params

  // Verify user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Use admin client to bypass RLS
  const admin = createAdminClient()

  // Get lecture to find event_id for storage path
  const { data: lecture, error: lectureError } = await admin
    .from('lectures')
    .select('id, event_id, audio_path')
    .eq('id', lectureId)
    .single()

  if (lectureError || !lecture) {
    return NextResponse.json({ error: 'Palestra não encontrada' }, { status: 404 })
  }

  const typedLecture = lecture as unknown as { id: string; event_id: string; audio_path: string | null }
  const storagePath = typedLecture.audio_path ?? `${typedLecture.event_id}/${typedLecture.id}`

  try {
    // 1. List and delete all audio files from storage
    const { data: files } = await admin.storage
      .from('audio-files')
      .list(storagePath)

    if (files && files.length > 0) {
      const filePaths = files.map(f => `${storagePath}/${f.name}`)
      await admin.storage
        .from('audio-files')
        .remove(filePaths)
    }

    // 2. Reset lecture fields
    await admin
      .from('lectures')
      .update({
        status: 'scheduled',
        processing_progress: 0,
        audio_path: null,
        audio_duration_seconds: null,
        transcript_text: null,
        summary: null,
        topics: null,
      } as never)
      .eq('id', lectureId)

    // 3. Delete processing jobs
    await admin
      .from('processing_jobs')
      .delete()
      .eq('lecture_id', lectureId)

    // 4. Delete generated materials
    await admin
      .from('lecture_materials')
      .delete()
      .eq('lecture_id', lectureId)

    // 5. Delete generation configs
    await admin
      .from('generation_configs')
      .delete()
      .eq('lecture_id', lectureId)

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Error deleting audio:', e)
    return NextResponse.json(
      { error: `Erro ao excluir: ${e instanceof Error ? e.message : e}` },
      { status: 500 }
    )
  }
}
