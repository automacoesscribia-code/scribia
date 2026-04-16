import { createClient } from '@/lib/supabase-server'
import { SpeakersPageClient } from '@/components/speakers/speakers-page-client'
import { ChevronRight, UserCircle } from 'lucide-react'

export default async function SpeakersPage() {
  const supabase = await createClient()

  // Get active event
  const { data: eventData } = await supabase
    .from('events')
    .select('id, name')
    .eq('status', 'active')
    .order('start_date', { ascending: false })
    .limit(1)

  let event = (eventData as unknown as Array<{ id: string; name: string }>)?.[0]

  if (!event) {
    const { data: anyEvent } = await supabase
      .from('events')
      .select('id, name')
      .order('start_date', { ascending: false })
      .limit(1)
    event = (anyEvent as unknown as Array<{ id: string; name: string }>)?.[0]
  }

  if (!event) {
    return (
      <div className="max-w-5xl">
        <p className="text-text3 text-[13px]">Nenhum evento encontrado. Crie um evento primeiro.</p>
      </div>
    )
  }

  // Fetch confirmed speakers with their lectures
  const { data: speakerData } = await supabase
    .from('speakers')
    .select('id, name, email, created_at')

  const speakers = (speakerData ?? []) as unknown as Array<{
    id: string; name: string; email: string | null; created_at: string
  }>

  // Fetch lectures to link speakers to their talks
  const { data: lectureData } = await supabase
    .from('lectures')
    .select('id, title, speaker_id')
    .eq('event_id', event.id)

  const lectures = (lectureData ?? []) as unknown as Array<{
    id: string; title: string; speaker_id: string | null
  }>

  // Build confirmed speakers (those with a lecture)
  const confirmed = speakers
    .filter((s) => lectures.some((l) => l.speaker_id === s.id))
    .map((s) => ({
      ...s,
      lectureTitle: lectures.find((l) => l.speaker_id === s.id)?.title ?? '',
    }))

  // Fetch pending invitations from invitations table (real status)
  const { data: invitationData } = await supabase
    .from('invitations')
    .select('id, email, status, created_at, expires_at, speaker_id')
    .eq('role', 'speaker')
    .eq('event_id', event.id)
    .in('status', ['pending'])
    .order('created_at', { ascending: false })

  const pendingInvitations = (invitationData ?? []) as unknown as Array<{
    id: string; email: string; status: string; created_at: string; expires_at: string; speaker_id: string | null
  }>

  // Map pending invitations to speaker names
  const pending = pendingInvitations.map((inv) => {
    const speaker = inv.speaker_id ? speakers.find((s) => s.id === inv.speaker_id) : null
    return {
      id: inv.id,
      email: inv.email,
      speakerName: speaker?.name ?? null,
      sentAt: inv.created_at,
      status: inv.status as 'pending' | 'accepted' | 'expired' | 'revoked',
      expiresAt: inv.expires_at,
    }
  })

  return (
    <div className="max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[12px] text-text3 mb-6">
        <span className="hover:text-purple-light cursor-pointer transition-colors">
          {event.name}
        </span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-text2">Palestrantes</span>
      </div>

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="font-heading text-[22px] sm:text-[26px] font-extrabold text-text leading-tight">
            Adicionar Palestrantes
          </h1>
          <p className="text-[13px] text-text3 mt-1">
            Convide por e-mail ou importe uma lista CSV
          </p>
        </div>
        <div className="bg-purple-dim border border-border-purple rounded-full px-3.5 py-1.5 text-[12px] text-purple-light flex items-center gap-1.5 self-start sm:self-auto shrink-0">
          <UserCircle className="w-3.5 h-3.5" />
          {confirmed.length} confirmados · {pending.length} pendentes
        </div>
      </div>

      {/* Client component for interactive parts */}
      <SpeakersPageClient
        eventId={event.id}
        initialConfirmed={confirmed}
        initialPending={pending}
      />
    </div>
  )
}
