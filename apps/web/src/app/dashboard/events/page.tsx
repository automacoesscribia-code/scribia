import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { EventCard } from '@/components/events/event-card'
import { EventFilters } from '@/components/events/event-filters'
import type { EventStatus } from '@scribia/shared'
import type { Database } from '@scribia/supabase-client'
import { Plus } from 'lucide-react'

type EventRow = Database['public']['Tables']['events']['Row']
type EventWithCount = EventRow & { lectures: { count: number }[] }

interface Props {
  searchParams: Promise<{ status?: string; q?: string }>
}

export default async function EventsListPage({ searchParams }: Props) {
  const supabase = await createClient()
  const params = await searchParams

  const query = supabase
    .from('events')
    .select('*, lectures(count)')
    .order('start_date', { ascending: false })

  if (params.status && params.status !== 'all') {
    query.eq('status', params.status)
  }

  if (params.q) {
    query.ilike('name', `%${params.q}%`)
  }

  const { data } = await query
  const events = (data ?? []) as unknown as EventWithCount[]

  return (
    <div className="max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 md:mb-9">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-text">Eventos</h1>
          <p className="text-[13px] text-text3 mt-0.5">Gerencie todos os seus eventos</p>
        </div>
        <Link
          href="/dashboard/events/new"
          className="inline-flex items-center justify-center gap-1.5 bg-purple text-white px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all hover:bg-purple-light glow-purple self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Novo Evento
        </Link>
      </div>

      <EventFilters currentStatus={params.status} currentQuery={params.q} />

      {events.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5 stagger-children">
          {events.map((event) => (
            <EventCard
              key={event.id}
              id={event.id}
              name={event.name}
              start_date={event.start_date}
              end_date={event.end_date}
              status={event.status as EventStatus}
              location={event.location}
              cover_image_url={event.cover_image_url}
              lecture_count={event.lectures?.[0]?.count ?? 0}
            />
          ))}
        </div>
      ) : (
        <div className="mt-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-dim border border-border-purple flex items-center justify-center mx-auto mb-4">
            <Plus className="w-7 h-7 text-purple-light" />
          </div>
          <p className="text-lg text-text2">Nenhum evento criado.</p>
          <p className="mt-2 text-text3">
            <Link href="/dashboard/events/new" className="text-purple-light hover:text-purple transition-colors">
              Crie seu primeiro evento!
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}
