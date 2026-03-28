import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function AdminEventsPage() {
  const supabase = await createClient()

  const { data: events } = await supabase
    .from('events')
    .select('id, name, status, start_date, end_date, organizer_id')
    .order('start_date', { ascending: false })

  const eventList = (events ?? []) as Array<{
    id: string; name: string; status: string; start_date: string; end_date: string; organizer_id: string
  }>

  // Get organizer names
  const orgIds = [...new Set(eventList.map((e) => e.organizer_id))]
  let orgNames: Record<string, string> = {}

  if (orgIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, full_name, email')
      .in('id', orgIds)

    const profs = (profiles ?? []) as Array<{ id: string; full_name: string; email: string }>
    orgNames = profs.reduce((acc, p) => {
      acc[p.id] = p.full_name || p.email
      return acc
    }, {} as Record<string, string>)
  }

  const statusLabel: Record<string, string> = {
    draft: 'Rascunho',
    active: 'Ativo',
    completed: 'Concluído',
    archived: 'Arquivado',
  }

  const statusColor: Record<string, string> = {
    draft: 'text-text3 bg-bg3',
    active: 'text-scribia-green bg-scribia-green/10',
    completed: 'text-purple-light bg-purple-dim',
    archived: 'text-text3 bg-bg3',
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-9">
        <h1 className="font-heading text-2xl font-bold text-text">Todos os Eventos</h1>
        <p className="text-[13px] text-text3 mt-0.5">{eventList.length} eventos na plataforma</p>
      </div>

      {eventList.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-text3 text-[13px]">Nenhum evento criado ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {eventList.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between px-5 py-4 bg-bg2 border border-border-subtle rounded-xl"
            >
              <div>
                <div className="text-[13px] font-medium text-text">{event.name}</div>
                <div className="text-[11px] text-text3 mt-0.5">
                  por {orgNames[event.organizer_id] ?? 'Desconhecido'} ·{' '}
                  {new Date(event.start_date).toLocaleDateString('pt-BR')}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-md text-[11px] font-medium ${statusColor[event.status] ?? ''}`}>
                  {statusLabel[event.status] ?? event.status}
                </span>
                <Link
                  href={`/dashboard/events/${event.id}`}
                  className="text-[12px] text-purple-light hover:text-purple transition-colors"
                >
                  Ver
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
