import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { LectureDetailClient } from '@/components/lectures/lecture-detail-dashboard'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string }>
}

export default async function LectureDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data } = await supabase
    .from('lectures')
    .select('*, speakers(name, email), events(id, name)')
    .eq('id', id)
    .single()

  const lecture = data as unknown as {
    id: string; title: string; description: string | null;
    status: string; scheduled_at: string | null; duration_seconds: number | null;
    audio_path: string | null; audio_duration_seconds: number | null;
    transcript_text: string | null; summary: string | null; topics: string[] | null;
    ebook_url: string | null; playbook_url: string | null; card_image_url: string | null;
    processing_progress: number; event_id: string;
    speaker_id: string | null; created_at: string; updated_at: string;
    speakers: { name: string; email: string | null } | null;
    events: { id: string; name: string } | null;
  } | null

  if (!lecture) notFound()

  // Get audio chunks listing from storage (use admin client to bypass RLS)
  const storagePath = lecture.audio_path ?? `${lecture.event_id}/${lecture.id}`
  const { data: audioFiles } = await adminClient.storage
    .from('audio-files')
    .list(storagePath)

  const audioChunks = (audioFiles ?? [])
    .filter((f: { name: string }) => f.name.endsWith('.wav'))
    .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))

  // Get signed URL for first chunk (for preview)
  let audioUrl: string | null = null
  if (audioChunks.length > 0) {
    const { data: signedData } = await adminClient.storage
      .from('audio-files')
      .createSignedUrl(`${storagePath}/${audioChunks[0].name}`, 3600)
    audioUrl = signedData?.signedUrl ?? null
  }

  return (
    <div className="max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[12px] text-text3 mb-6">
        <Link href={`/dashboard/events/${lecture.event_id}`} className="hover:text-purple-light transition-colors">
          {lecture.events?.name ?? 'Evento'}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-text2">{lecture.title}</span>
      </div>

      <LectureDetailClient
        lecture={lecture}
        audioUrl={audioUrl}
        audioChunkCount={audioChunks.length}
        eventId={lecture.event_id}
      />
    </div>
  )
}
