import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { PortalContent } from '@/components/portal/portal-content'

export default async function PortalPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Get user profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const userName = (profile as { full_name: string } | null)?.full_name ?? user.email?.split('@')[0] ?? 'Participante'

  // Get lectures via lecture_access (RLS enforced)
  const { data: accessData } = await supabase
    .from('lecture_access')
    .select(`
      lecture_id,
      lectures(
        id, title, status, duration_seconds, ebook_content,
        speakers(name),
        events(name)
      )
    `)
    .eq('user_id', user.id)

  type LectureAccess = {
    lecture_id: string
    lectures: {
      id: string
      title: string
      status: string
      duration_seconds: number | null
      ebook_content: string | null
      speakers: { name: string } | null
      events: { name: string } | null
    } | null
  }

  const accessRows = (accessData ?? []) as unknown as LectureAccess[]

  const lectures = accessRows
    .filter((a) => a.lectures)
    .map((a) => ({
      id: a.lectures!.id,
      title: a.lectures!.title,
      status: a.lectures!.status,
      duration_seconds: a.lectures!.duration_seconds,
      ebook_content: a.lectures!.ebook_content,
      speaker_name: a.lectures!.speakers?.name ?? 'Palestrante',
      event_name: a.lectures!.events?.name ?? 'Evento',
    }))

  // Stats
  const ebookCount = lectures.filter((l) => l.ebook_content).length

  // Get total participants in event (for hero stat)
  let participantCount = 0
  if (lectures.length > 0) {
    const { count } = await supabase
      .from('event_participants')
      .select('*', { count: 'exact', head: true })
    participantCount = count ?? 0
  }

  return (
    <PortalContent
      lectures={lectures}
      userName={userName}
      stats={{
        lectureCount: lectures.length,
        ebookCount,
        participantCount,
      }}
    />
  )
}
