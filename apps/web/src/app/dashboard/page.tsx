import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { StatCard } from '@/components/ui/stat-card'
import { RecentLecturesTable } from '@/components/dashboard/recent-lectures-table'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { ProcessingOverview } from '@/components/dashboard/processing-overview'
import { Plus, Download } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Get active event (most recent)
  const { data: eventData } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'active')
    .order('start_date', { ascending: false })
    .limit(1)

  const event = (eventData as unknown as Array<{
    id: string; name: string; start_date: string; end_date: string; status: string
  }>)?.[0]

  // If no active event, try most recent of any status
  let fallbackEvent = event
  if (!fallbackEvent) {
    const { data: anyEvent } = await supabase
      .from('events')
      .select('*')
      .order('start_date', { ascending: false })
      .limit(1)
    fallbackEvent = (anyEvent as unknown as Array<{
      id: string; name: string; start_date: string; end_date: string; status: string
    }>)?.[0]
  }

  // No events at all — empty state
  if (!fallbackEvent) {
    return (
      <div className="max-w-6xl">
        <div className="flex items-center justify-between mb-9">
          <div>
            <h1 className="font-heading text-2xl font-bold text-text">Dashboard</h1>
            <p className="text-[13px] text-text3 mt-0.5">Bem-vindo ao ScribIA</p>
          </div>
        </div>
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
      </div>
    )
  }

  const activeEvent = fallbackEvent

  // Fetch lectures for active event
  const { data: lectureData } = await supabase
    .from('lectures')
    .select('id, title, status, duration_seconds, ebook_content, speakers(name)')
    .eq('event_id', activeEvent.id)
    .order('scheduled_at', { ascending: false })

  const lectures = (lectureData ?? []) as unknown as Array<{
    id: string; title: string; status: string; duration_seconds: number | null;
    ebook_content: string | null; speakers: { name: string } | null
  }>

  const recentLectures = lectures.slice(0, 5)

  // Compute stats
  const totalLectures = lectures.length
  const completedLectures = lectures.filter((l) => l.status === 'completed').length
  const totalHours = Math.round(
    lectures
      .filter((l) => l.status === 'completed')
      .reduce((acc, l) => acc + (l.duration_seconds ?? 0), 0) / 3600
  )
  const ebooksGenerated = lectures.filter((l) => l.ebook_content).length
  const ebooksPending = completedLectures - ebooksGenerated

  // Fetch processing job counts
  const lectureIds = lectures.map((l) => l.id)
  let transcribed = completedLectures
  let cardsGenerated = 0
  let playbooksGenerated = 0

  if (lectureIds.length > 0) {
    const { data: jobs } = await supabase
      .from('processing_jobs')
      .select('type, status')
      .in('lecture_id', lectureIds)
      .eq('status', 'completed')

    const completedJobs = (jobs ?? []) as unknown as Array<{ type: string; status: string }>
    transcribed = completedJobs.filter((j) => j.type === 'transcription').length || completedLectures
    cardsGenerated = completedJobs.filter((j) => j.type === 'card').length
    playbooksGenerated = completedJobs.filter((j) => j.type === 'playbook').length
  }

  // Fetch download/access count
  const { count: downloadCount } = await supabase
    .from('lecture_access')
    .select('*', { count: 'exact', head: true })

  const downloads = downloadCount ?? 0
  const engagementRate = totalLectures > 0 ? Math.round((downloads / Math.max(totalLectures, 1)) * 100) : 0

  // Format dates
  const startDate = new Date(activeEvent.start_date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
  const endDate = new Date(activeEvent.end_date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="max-w-6xl">
      {/* Topbar */}
      <div className="flex items-center justify-between mb-9">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Dashboard</h1>
          <p className="text-[13px] text-text3 mt-0.5">
            {activeEvent.name} · {startDate}–{endDate}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-1.5 bg-transparent border border-border-subtle text-text2 px-4 py-2.5 rounded-lg text-[13px] transition-all hover:border-border-purple hover:text-purple-light">
            <Download className="w-3.5 h-3.5" />
            Exportar relatório
          </button>
          <Link
            href={`/dashboard/events/${activeEvent.id}`}
            className="inline-flex items-center gap-1.5 bg-purple text-white px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all hover:bg-purple-light glow-purple"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova palestra
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7 stagger-children">
        <StatCard
          label="Palestras"
          value={totalLectures}
          sub={`${completedLectures} concluídas`}
          badge={completedLectures > 0 ? `${completedLectures} processadas` : undefined}
          badgeVariant="green"
          accent="purple"
        />
        <StatCard
          label="Áudio convertido"
          value={`${totalHours}h`}
          sub="horas transcritas"
          badge={transcribed > 0 ? `${Math.round((transcribed / Math.max(totalLectures, 1)) * 100)}% processado` : undefined}
          badgeVariant="green"
          accent="green"
        />
        <StatCard
          label="E-books gerados"
          value={ebooksGenerated}
          sub={ebooksPending > 0 ? `${ebooksPending} aguardando revisão` : 'todos gerados'}
          badge={ebooksPending > 0 ? `↻ ${ebooksPending} pendentes` : undefined}
          badgeVariant="yellow"
          accent="yellow"
        />
        <StatCard
          label="Downloads"
          value={downloads}
          sub={`taxa: ${engagementRate}% de engajamento`}
          badge={downloads > 0 ? `▲ ativo` : undefined}
          badgeVariant="green"
          accent="teal"
        />
      </div>

      {/* Content Grid: Table (left) + Actions + Progress (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
        {/* Left: Recent lectures table */}
        <RecentLecturesTable lectures={recentLectures} eventId={activeEvent.id} />

        {/* Right: Quick actions + Processing */}
        <div className="flex flex-col gap-5">
          <QuickActions eventId={activeEvent.id} />
          <ProcessingOverview
            eventId={activeEvent.id}
            totalLectures={totalLectures}
            transcribed={transcribed}
            ebooksGenerated={ebooksGenerated}
            cardsGenerated={cardsGenerated}
            playbooksGenerated={playbooksGenerated}
          />
        </div>
      </div>
    </div>
  )
}
