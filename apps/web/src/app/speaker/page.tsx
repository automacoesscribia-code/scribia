import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { SpeakerWelcome } from '@/components/layout/speaker-welcome'

export default async function SpeakerPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Get user profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, roles')
    .eq('id', user.id)
    .single()

  const roles = (profile as { roles: string[] } | null)?.roles ?? []
  if (!roles.includes('speaker')) redirect('/login')

  const userName = (profile as { full_name: string } | null)?.full_name || user.email?.split('@')[0] || 'Palestrante'

  // Get speaker record linked to this user
  const { data: speakerData } = await supabase
    .from('speakers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  // Get lectures assigned to this speaker
  let lectures: Array<{ title: string; eventName: string; scheduledAt: string | null; status: string }> = []

  if (speakerData) {
    const { data: lectureData } = await supabase
      .from('lectures')
      .select('title, scheduled_at, status, events(name)')
      .eq('speaker_id', (speakerData as { id: string }).id)

    lectures = ((lectureData ?? []) as unknown as Array<{
      title: string; scheduled_at: string | null; status: string; events: { name: string } | null
    }>).map((l) => ({
      title: l.title,
      eventName: l.events?.name ?? 'Evento',
      scheduledAt: l.scheduled_at,
      status: l.status,
    }))
  }

  return <SpeakerWelcome userName={userName} lectures={lectures} />
}
