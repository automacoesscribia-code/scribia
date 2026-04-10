import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { LectureDetailClient } from '@/components/portal/lecture-detail-client'

interface Props {
  params: Promise<{ id: string }>
}

export default async function LectureDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Verify access
  const { data: access } = await supabase
    .from('lecture_access')
    .select('id')
    .eq('user_id', user.id)
    .eq('lecture_id', id)
    .single()

  if (!access) notFound()

  // Mark accessed
  await supabase
    .from('lecture_access')
    .update({ accessed_at: new Date().toISOString() } as never)
    .eq('user_id', user.id)
    .eq('lecture_id', id)

  // Fetch lecture with details
  const { data: lecture } = await supabase
    .from('lectures')
    .select('id, title, status, duration_seconds, audio_path, event_id, ebook_content, playbook_content, summary, transcript, speakers(name), events(name)')
    .eq('id', id)
    .single()

  if (!lecture) notFound()

  type LectureData = {
    id: string; title: string; status: string; duration_seconds: number | null
    audio_path: string | null; event_id: string
    ebook_content: string | null; playbook_content: string | null
    summary: string | null; transcript: string | null
    speakers: { name: string } | null; events: { name: string } | null
  }

  const l = lecture as unknown as LectureData

  // Get audio chunks from storage (admin client bypasses RLS)
  const storagePath = l.audio_path ?? `${l.event_id}/${l.id}`
  const { data: audioFiles } = await adminClient.storage
    .from('audio-files')
    .list(storagePath)

  const getChunkIndex = (name: string) => {
    const m = name.match(/chunk_(\d+)\.wav$/); return m ? parseInt(m[1], 10) : 0
  }
  const audioChunks = (audioFiles ?? [])
    .filter((f: { name: string }) => f.name.endsWith('.wav'))
    .sort((a: { name: string }, b: { name: string }) => getChunkIndex(a.name) - getChunkIndex(b.name))

  // Use concatenation API for full audio playback
  const audioUrl = audioChunks.length > 0 ? `/api/audio/${l.id}` : null

  return (
    <div className="max-w-[900px] mx-auto px-10 py-9">
      <LectureDetailClient
        lectureId={l.id}
        title={l.title}
        speaker={l.speakers?.name ?? 'Palestrante'}
        eventName={l.events?.name ?? 'Evento'}
        duration={l.duration_seconds}
        status={l.status}
        summary={l.summary}
        ebookContent={l.ebook_content}
        playbookContent={l.playbook_content}
        transcript={l.transcript}
        audioUrl={audioUrl}
      />
    </div>
  )
}
