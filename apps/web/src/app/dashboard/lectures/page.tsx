import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { Chip } from '@/components/ui/chip'
import { Plus, Mic } from 'lucide-react'
import type { LectureStatus } from '@scribia/shared'

const statusConfig: Record<string, { label: string; variant: 'green' | 'yellow' | 'purple' | 'red' | 'default' }> = {
  scheduled: { label: 'Agendada', variant: 'default' },
  recording: { label: 'Gravando', variant: 'red' },
  processing: { label: 'Processando', variant: 'yellow' },
  completed: { label: 'Concluída', variant: 'green' },
  failed: { label: 'Falhou', variant: 'red' },
}

export default async function LecturesPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('lectures')
    .select('id, title, status, scheduled_at, duration_seconds, event_id, speakers(name), events(name)')
    .order('scheduled_at', { ascending: false })

  const lectures = (data ?? []) as unknown as Array<{
    id: string; title: string; status: string; scheduled_at: string | null;
    duration_seconds: number | null; event_id: string;
    speakers: { name: string } | null; events: { name: string } | null
  }>

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6 md:mb-9">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-text">Palestras</h1>
          <p className="text-[13px] text-text3 mt-0.5">Todas as palestras dos seus eventos</p>
        </div>
      </div>

      {lectures.length > 0 ? (
        <div className="space-y-2">
          {lectures.map((lecture) => {
            const { label, variant } = statusConfig[lecture.status] ?? statusConfig.scheduled
            return (
              <Link key={lecture.id} href={`/dashboard/lectures/${lecture.id}`}>
                <div className="flex items-center gap-3 bg-bg2 border border-border-subtle rounded-xl p-4 transition-all hover:border-border-purple">
                  <div className="w-9 h-9 rounded-lg bg-purple-dim border border-border-purple flex items-center justify-center">
                    <Mic className="w-4 h-4 text-purple-light" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-semibold text-[13px] text-text">{lecture.title}</p>
                    <p className="text-[11px] text-text3 mt-0.5">
                      {lecture.speakers?.name ?? 'Sem palestrante'} · {lecture.events?.name ?? 'Evento'}
                    </p>
                  </div>
                  <Chip variant={variant}>{label}</Chip>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="mt-16 text-center">
          <p className="text-text3 text-[13px]">Nenhuma palestra cadastrada. Crie um evento primeiro.</p>
        </div>
      )}
    </div>
  )
}
