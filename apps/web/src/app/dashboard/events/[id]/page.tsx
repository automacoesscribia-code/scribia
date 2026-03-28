import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { EventHeader } from '@/components/events/event-header'
import { EventTabs } from '@/components/events/event-tabs'
import type { Database } from '@scribia/supabase-client'

type EventRow = Database['public']['Tables']['events']['Row']

interface Props {
  params: Promise<{ id: string }>
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()

  const event = data as unknown as EventRow | null
  if (!event) notFound()

  const { data: lectureData } = await supabase
    .from('lectures')
    .select('id, title, description, status, scheduled_at, duration_seconds, speaker_id, speakers(name)')
    .eq('event_id', id)
    .order('scheduled_at', { ascending: true })

  const lectures = (lectureData ?? []) as unknown as Array<{
    id: string; title: string; description: string | null; status: string;
    scheduled_at: string | null; duration_seconds: number | null;
    speaker_id: string | null; speakers: { name: string } | null
  }>

  const { data: speakerData } = await supabase.from('speakers').select('*')
  const speakers = (speakerData ?? []) as unknown as Array<{
    id: string; name: string; email: string | null; bio: string | null;
    company: string | null; role: string | null
  }>

  const { data: participantData } = await supabase
    .from('event_participants')
    .select('id, user_id, attended, registered_at, user_profiles(full_name, email)')
    .eq('event_id', id)

  const participants = (participantData ?? []) as unknown as Array<{
    id: string; user_id: string; attended: boolean; registered_at: string;
    user_profiles: { full_name: string; email: string } | null
  }>

  return (
    <div className="max-w-6xl">
      <EventHeader event={event} />
      <EventTabs eventId={id} lectures={lectures} speakers={speakers} participants={participants} />
    </div>
  )
}
