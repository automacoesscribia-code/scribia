'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { StatCard } from '@/components/ui/stat-card'
import { Chip } from '@/components/ui/chip'
import { ReportGenerator } from './report-generator'
import { RefreshCw } from 'lucide-react'

interface AnalyticsTabProps {
  eventId: string
  eventStatus?: string
}

interface LectureAnalytics {
  id: string
  title: string
  status: string
  views: number
  ebook_downloads: number
  audio_plays: number
}

export function AnalyticsTab({ eventId, eventStatus = 'active' }: AnalyticsTabProps) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalLectures: 0,
    processedLectures: 0,
    totalParticipants: 0,
    activeParticipants: 0,
    totalDownloads: 0,
    engagementRate: 0,
  })
  const [lectures, setLectures] = useState<LectureAnalytics[]>([])
  const supabase = createClient()

  async function loadAnalytics() {
    setLoading(true)

    // Lectures
    const { data: lectureData } = await supabase
      .from('lectures')
      .select('id, title, status')
      .eq('event_id', eventId)

    const lectureList = (lectureData ?? []) as unknown as Array<{ id: string; title: string; status: string }>
    const lectureIds = lectureList.map((l) => l.id)

    // Participants
    const { count: totalParticipants } = await supabase
      .from('event_participants')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)

    // Access data
    let accessData: Array<{ lecture_id: string; accessed_at: string | null; download_count: number }> = []
    if (lectureIds.length > 0) {
      const { data } = await supabase
        .from('lecture_access')
        .select('lecture_id, accessed_at, download_count')
        .in('lecture_id', lectureIds)
      accessData = (data ?? []) as unknown as typeof accessData
    }

    // Compute per-lecture analytics
    const lectureAnalytics: LectureAnalytics[] = lectureList.map((l) => {
      const accesses = accessData.filter((a) => a.lecture_id === l.id)
      return {
        id: l.id,
        title: l.title,
        status: l.status,
        views: accesses.filter((a) => a.accessed_at).length,
        ebook_downloads: accesses.reduce((sum, a) => sum + (a.download_count ?? 0), 0),
        audio_plays: accesses.filter((a) => a.accessed_at).length,
      }
    })

    const processed = lectureList.filter((l) => l.status === 'completed').length
    const activeUsers = new Set(accessData.filter((a) => a.accessed_at).map((a) => a.lecture_id)).size
    const totalDl = accessData.reduce((sum, a) => sum + (a.download_count ?? 0), 0)
    const total = totalParticipants ?? 0
    const rate = total > 0 ? Math.round((activeUsers / total) * 100) : 0

    setStats({
      totalLectures: lectureList.length,
      processedLectures: processed,
      totalParticipants: total,
      activeParticipants: activeUsers,
      totalDownloads: totalDl,
      engagementRate: rate,
    })
    setLectures(lectureAnalytics)
    setLoading(false)
  }

  useEffect(() => { loadAnalytics() }, [eventId])

  if (loading) {
    return <div className="text-center py-12 text-text3 text-[13px]">Carregando analytics...</div>
  }

  return (
    <div>
      {/* Refresh button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={loadAnalytics}
          className="inline-flex items-center gap-1.5 text-[12px] bg-transparent border border-border-subtle text-text2 rounded-lg px-3 py-1.5 hover:border-border-purple hover:text-purple-light transition-all"
        >
          <RefreshCw className="w-3 h-3" />
          Atualizar dados
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger-children">
        <StatCard
          label="Palestras"
          value={stats.totalLectures}
          sub={`${stats.processedLectures} processadas`}
          accent="purple"
        />
        <StatCard
          label="Participantes"
          value={stats.totalParticipants}
          sub={`${stats.activeParticipants} acessaram conteúdo`}
          accent="green"
        />
        <StatCard
          label="Downloads"
          value={stats.totalDownloads}
          sub="e-books + playbooks"
          accent="teal"
        />
        <StatCard
          label="Engajamento"
          value={`${stats.engagementRate}%`}
          sub="participantes ativos / registrados"
          badge={stats.engagementRate > 50 ? 'Alto' : stats.engagementRate > 25 ? 'Médio' : 'Baixo'}
          badgeVariant={stats.engagementRate > 50 ? 'green' : 'yellow'}
          accent="yellow"
        />
      </div>

      {/* Engagement bar chart (simple CSS bars) */}
      <div className="bg-bg2 border border-border-subtle rounded-[14px] overflow-hidden mb-6 animate-fade-up">
        <div className="px-5 py-4 border-b border-border-subtle">
          <h3 className="font-heading text-sm font-bold text-text">Engajamento por palestra</h3>
        </div>
        <div className="p-5">
          {lectures.map((l) => {
            const maxViews = Math.max(...lectures.map((x) => x.views), 1)
            const pct = (l.views / maxViews) * 100
            return (
              <div key={l.id} className="mb-3 last:mb-0">
                <div className="flex justify-between mb-1">
                  <span className="text-[12px] text-text2 truncate max-w-[60%]">{l.title}</span>
                  <span className="text-[11px] text-text3">{l.views} views</span>
                </div>
                <div className="h-2 bg-bg4 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-purple rounded-sm transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
          {lectures.length === 0 && (
            <p className="text-center text-[13px] text-text3 py-4">Nenhuma palestra cadastrada.</p>
          )}
        </div>
      </div>

      {/* Report Generator */}
      <div className="mb-6">
        <ReportGenerator eventId={eventId} eventStatus={eventStatus} />
      </div>

      {/* Per-lecture table */}
      <div className="bg-bg2 border border-border-subtle rounded-[14px] overflow-hidden animate-fade-up">
        <div className="px-5 py-4 border-b border-border-subtle">
          <h3 className="font-heading text-sm font-bold text-text">Detalhamento por palestra</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-[10.5px] text-text3 uppercase tracking-[0.8px] px-5 py-2.5 text-left border-b border-border-subtle">Palestra</th>
                <th className="text-[10.5px] text-text3 uppercase tracking-[0.8px] px-5 py-2.5 text-left border-b border-border-subtle">Status</th>
                <th className="text-[10.5px] text-text3 uppercase tracking-[0.8px] px-5 py-2.5 text-right border-b border-border-subtle">Views</th>
                <th className="text-[10.5px] text-text3 uppercase tracking-[0.8px] px-5 py-2.5 text-right border-b border-border-subtle">Downloads</th>
                <th className="text-[10.5px] text-text3 uppercase tracking-[0.8px] px-5 py-2.5 text-right border-b border-border-subtle">Plays</th>
              </tr>
            </thead>
            <tbody>
              {lectures.map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-bg3">
                  <td className="px-5 py-3 text-[13px] text-text border-b border-border-subtle">{l.title}</td>
                  <td className="px-5 py-3 border-b border-border-subtle">
                    <Chip variant={l.status === 'completed' ? 'green' : l.status === 'processing' ? 'yellow' : 'default'}>
                      {l.status === 'completed' ? 'Concluída' : l.status === 'processing' ? 'Processando' : 'Agendada'}
                    </Chip>
                  </td>
                  <td className="px-5 py-3 text-[13px] text-text2 text-right border-b border-border-subtle font-mono">{l.views}</td>
                  <td className="px-5 py-3 text-[13px] text-text2 text-right border-b border-border-subtle font-mono">{l.ebook_downloads}</td>
                  <td className="px-5 py-3 text-[13px] text-text2 text-right border-b border-border-subtle font-mono">{l.audio_plays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
