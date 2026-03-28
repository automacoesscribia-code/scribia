'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { LectureStatusBadge } from '@/components/lectures/lecture-status-badge'
import { LectureFormModal } from '@/components/lectures/lecture-form-modal'
import { SpeakerFormModal } from '@/components/speakers/speaker-form-modal'
import { ParticipantsTab } from '@/components/participants/participants-tab'
import type { LectureStatus } from '@scribia/shared'
import { AnalyticsTab } from '@/components/dashboard/analytics-tab'
import Link from 'next/link'
import { Plus, Pencil, Trash2, Radio, RefreshCw } from 'lucide-react'

interface Speaker {
  id: string
  name: string
  email: string | null
  bio: string | null
  company: string | null
  role: string | null
}

interface Lecture {
  id: string
  title: string
  description: string | null
  status: string
  scheduled_at: string | null
  duration_seconds: number | null
  speaker_id: string | null
  speakers: { name: string } | null
}

interface Participant {
  id: string
  user_id: string
  attended: boolean
  registered_at: string
  user_profiles: { full_name: string; email: string } | null
}

interface EventTabsProps {
  eventId: string
  lectures: Lecture[]
  speakers?: Speaker[]
  participants?: Participant[]
}

const TABS = [
  { id: 'lectures', label: 'Palestras' },
  { id: 'speakers', label: 'Palestrantes' },
  { id: 'participants', label: 'Participantes' },
  { id: 'analytics', label: 'Analytics' },
] as const

export function EventTabs({ eventId, lectures, speakers: initialSpeakers = [], participants: initialParticipants = [] }: EventTabsProps) {
  const [activeTab, setActiveTab] = useState<string>('lectures')
  const [showLectureModal, setShowLectureModal] = useState(false)
  const [showSpeakerModal, setShowSpeakerModal] = useState(false)
  const [editingLecture, setEditingLecture] = useState<Lecture | null>(null)
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null)
  const [speakers, setSpeakers] = useState<Speaker[]>(initialSpeakers)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const router = useRouter()
  const supabase = createClient()

  const refresh = useCallback(() => {
    router.refresh()
    setShowLectureModal(false)
    setShowSpeakerModal(false)
    setEditingLecture(null)
    setEditingSpeaker(null)
  }, [router])

  async function loadSpeakers() {
    const { data } = await supabase.from('speakers').select('*')
    if (data) setSpeakers(data as unknown as Speaker[])
  }

  async function deleteLecture(id: string) {
    if (!confirm('Excluir esta palestra?')) return
    await supabase.from('lectures').delete().eq('id', id)
    refresh()
  }

  async function deleteSpeaker(id: string) {
    if (!confirm('Excluir este palestrante?')) return
    await supabase.from('speakers').delete().eq('id', id)
    refresh()
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function reprocessSelected() {
    for (const lectureId of selected) {
      await supabase.from('lectures').update({ status: 'processing', processing_progress: 0 } as never).eq('id', lectureId)
    }
    setSelected(new Set())
    refresh()
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex border-b border-border-subtle">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); if (tab.id === 'speakers') loadSpeakers() }}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-purple text-purple-light'
                : 'border-transparent text-text3 hover:text-text2'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {/* ===== LECTURES TAB ===== */}
        {activeTab === 'lectures' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-[13px] text-text3">{lectures.length} palestras</span>
              <div className="flex gap-2">
                {selected.size > 0 && (
                  <button
                    onClick={reprocessSelected}
                    className="inline-flex items-center gap-1.5 text-[12px] bg-scribia-yellow/10 border border-scribia-yellow/25 text-scribia-yellow rounded-lg px-3 py-1.5 hover:bg-scribia-yellow/20 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Reprocessar ({selected.size})
                  </button>
                )}
                <button
                  onClick={() => { loadSpeakers(); setEditingLecture(null); setShowLectureModal(true) }}
                  className="inline-flex items-center gap-1.5 text-[12px] bg-purple text-white rounded-lg px-3 py-1.5 hover:bg-purple-light glow-purple transition-all"
                >
                  <Plus className="w-3 h-3" />
                  Nova Palestra
                </button>
              </div>
            </div>

            {lectures.length > 0 ? (
              <div className="space-y-2">
                {lectures.map((lecture) => (
                  <div
                    key={lecture.id}
                    className="flex items-center gap-3 bg-bg2 border border-border-subtle rounded-xl p-3.5 transition-all hover:border-border-purple"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(lecture.id)}
                      onChange={() => toggleSelect(lecture.id)}
                      className="h-4 w-4 rounded border-border-subtle bg-bg3 accent-purple"
                    />
                    <Link href={`/dashboard/lectures/${lecture.id}`} className="flex-1 min-w-0 cursor-pointer">
                      <p className="font-heading font-semibold text-[13px] text-text hover:text-purple-light transition-colors">
                        {lecture.title}
                      </p>
                      <p className="text-[12px] text-text3 mt-0.5">
                        {lecture.speakers?.name ?? 'Sem palestrante'}
                        {lecture.scheduled_at && ` — ${new Date(lecture.scheduled_at).toLocaleString('pt-BR')}`}
                        {lecture.duration_seconds && ` (${Math.round(lecture.duration_seconds / 60)}min)`}
                      </p>
                    </Link>
                    <LectureStatusBadge status={lecture.status as LectureStatus} />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => { loadSpeakers(); setEditingLecture(lecture); setShowLectureModal(true) }}
                        className="w-7 h-7 rounded-md bg-bg3 border border-border-subtle flex items-center justify-center text-text2 hover:border-border-purple hover:bg-purple-dim hover:text-purple-light transition-all"
                        title="Editar"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => deleteLecture(lecture.id)}
                        className="w-7 h-7 rounded-md bg-bg3 border border-border-subtle flex items-center justify-center text-text2 hover:border-scribia-red/40 hover:bg-scribia-red/8 hover:text-scribia-red transition-all"
                        title="Excluir"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <a
                        href={`scribia://capture/${eventId}/${lecture.id}`}
                        className="w-7 h-7 rounded-md bg-bg3 border border-border-subtle flex items-center justify-center text-text2 hover:border-border-purple hover:bg-purple-dim hover:text-purple-light transition-all"
                        title="Abrir no desktop para gravação"
                      >
                        <Radio className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-xl bg-purple-dim border border-border-purple flex items-center justify-center mx-auto mb-3">
                  <Plus className="w-5 h-5 text-purple-light" />
                </div>
                <p className="text-text3 text-[13px]">
                  Nenhuma palestra cadastrada.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ===== SPEAKERS TAB ===== */}
        {activeTab === 'speakers' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-[13px] text-text3">{speakers.length} palestrantes</span>
              <button
                onClick={() => { setEditingSpeaker(null); setShowSpeakerModal(true) }}
                className="inline-flex items-center gap-1.5 text-[12px] bg-purple text-white rounded-lg px-3 py-1.5 hover:bg-purple-light glow-purple transition-all"
              >
                <Plus className="w-3 h-3" />
                Novo Palestrante
              </button>
            </div>

            {speakers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {speakers.map((speaker) => (
                  <div
                    key={speaker.id}
                    className="flex items-center gap-3 bg-bg2 border border-border-subtle rounded-xl p-3.5 transition-all hover:border-border-purple"
                  >
                    <div className="w-9 h-9 rounded-full bg-purple-dim border border-border-purple flex items-center justify-center text-[11px] font-heading font-bold text-purple-light shrink-0">
                      {speaker.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[13px] text-text">{speaker.name}</p>
                      <p className="text-[11px] text-text3 truncate">
                        {[speaker.role, speaker.company].filter(Boolean).join(' — ') || 'Sem informações'}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => { setEditingSpeaker(speaker); setShowSpeakerModal(true) }}
                        className="w-7 h-7 rounded-md bg-bg3 border border-border-subtle flex items-center justify-center text-text2 hover:border-border-purple hover:bg-purple-dim hover:text-purple-light transition-all"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => deleteSpeaker(speaker.id)}
                        className="w-7 h-7 rounded-md bg-bg3 border border-border-subtle flex items-center justify-center text-text2 hover:border-scribia-red/40 hover:bg-scribia-red/8 hover:text-scribia-red transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text3 text-center py-12 text-[13px]">
                Nenhum palestrante cadastrado.
              </p>
            )}
          </div>
        )}

        {activeTab === 'participants' && (
          <ParticipantsTab
            eventId={eventId}
            participants={initialParticipants}
            lectureIds={lectures.map((l) => l.id)}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsTab eventId={eventId} />
        )}
      </div>

      {/* ===== MODALS ===== */}
      {showLectureModal && (
        <LectureFormModal
          eventId={eventId}
          speakers={speakers}
          lecture={editingLecture ? {
            id: editingLecture.id,
            title: editingLecture.title,
            description: editingLecture.description,
            speaker_id: editingLecture.speaker_id,
            scheduled_at: editingLecture.scheduled_at,
            duration_seconds: editingLecture.duration_seconds,
          } : undefined}
          onClose={() => setShowLectureModal(false)}
          onSaved={refresh}
          onCreateSpeaker={() => { setShowLectureModal(false); setEditingSpeaker(null); setShowSpeakerModal(true) }}
        />
      )}

      {showSpeakerModal && (
        <SpeakerFormModal
          speaker={editingSpeaker ?? undefined}
          onClose={() => setShowSpeakerModal(false)}
          onSaved={() => { loadSpeakers(); refresh() }}
        />
      )}
    </div>
  )
}
