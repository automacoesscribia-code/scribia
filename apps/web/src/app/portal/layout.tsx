import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { PortalHeader } from '@/components/layout/portal-header'

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const userName = (profile as { full_name: string } | null)?.full_name ?? user.email?.split('@')[0] ?? 'Participante'

  // Get event name for pill
  const { data: participantEvent } = await supabase
    .from('event_participants')
    .select('events(name)')
    .eq('user_id', user.id)
    .limit(1)

  const eventName = (participantEvent as unknown as Array<{ events: { name: string } | null }>)?.[0]?.events?.name ?? 'ScribIA'

  return (
    <div className="min-h-screen bg-bg">
      <PortalHeader userName={userName} eventName={eventName} />
      {children}
    </div>
  )
}
