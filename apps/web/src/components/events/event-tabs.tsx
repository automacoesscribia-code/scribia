'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { LectureStatusBadge } from '@/components/lectures/lecture-status-badge'
import { LectureFormModal } from '@/components/lectures/lecture-form-modal'
import { SpeakerFormModal } from '@/components/speakers/speaker-form-modal'
import { ParticipantsTab } from '@/components/participants/participants-tab'
import type { LectureStatus } from '@scribia/shared'
import { AnalyticsTab } from '@/components/dashboard/analytics-tab'
import Link from 'next/link'
import { Plus, Pencil, Trash2, Radio, RefreshCw, Upload, Loader2 } from 'lucide-react'

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

  // --- Audio Upload ---
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetRef = useRef<string | null>(null)
  const [uploadingLecture, setUploadingLecture] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  function handleUploadClick(lectureId: string) {
    uploadTargetRef.current = lectureId
    fileInputRef.current?.click()
  }

  async function handleAudioFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const lectureId = uploadTargetRef.current
    if (!file || !lectureId) return
    e.target.value = ''

    const MAX_SIZE_MB = 500
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`Arquivo muito grande. Máximo: ${MAX_SIZE_MB}MB`)
      return
    }

    setUploadingLecture(lectureId)
    setUploadProgress(10)

    try {
      const uploadPath = `audio-files/${eventId}/${lectureId}/final.webm`
      setUploadProgress(30)

      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(uploadPath, file, { contentType: file.type, upsert: true })

      if (uploadError) throw uploadError
      setUploadProgress(60)

      // Get audio duration
      const audioDuration = await new Promise<number>((resolve) => {
        const audio = new Audio()
        audio.addEventListener('loadedmetadata', () => {
          resolve(Math.round(audio.duration))
          URL.revokeObjectURL(audio.src)
        })
        audio.addEventListener('error', () => {
          resolve(Math.round(file.size / 176000))
          URL.revokeObjectURL(audio.src)
        })
        audio.src = URL.createObjectURL(file)
      })

      await supabase
        .from('lectures')
        .update({
          status: 'processing',
          audio_path: `${eventId}/${lectureId}`,
          audio_duration_seconds: audioDuration,
          processing_progress: 0,
        } as never)
        .eq('id', lectureId)

      setUploadProgress(80)

      // Create processing jobs
      const jobTypes = ['transcription', 'summary', 'ebook', 'playbook', 'card']
      for (const type of jobTypes) {
        await supabase
          .from('processing_jobs')
          .insert({ lecture_id: lectureId, type, status: 'queued' } as never)
      }

      setUploadProgress(100)
      setTimeout(() => {
        setUploadingLecture(null)
        setUploadProgress(0)
        refresh()
      }, 1500)
    } catch (err) {
      alert(`Erro no upload: ${err}`)
      setUploadingLecture(null)
      setUploadProgress(0)
    }
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

            {/* Hidden file input for audio upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.webm,.m4a,.ogg"
              className="hidden"
              onChange={handleAudioFileSelected}
            />

            {/* Upload progress banner */}
            {uploadingLecture && (
              <div className="mb-3 bg-purple-dim border border-border-purple rounded-xl p-3.5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[12px] text-purple-light font-medium flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {uploadProgress < 100 ? 'Enviando áudio...' : 'Upload concluído!'}
                  </span>
                  <span className="text-[12px] text-purple-light font-mono">{uploadProgress}%</span>
                </div>
                <div className="h-1.5 bg-bg4 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-purple rounded-sm transition-all duration-500"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {lectures.length > 0 ? (
              <div className="space-y-2">
                {lectures.map((lecture) => {
                  const isUploading = uploadingLecture === lecture.id
                  const canUpload = lecture.status === 'scheduled' || lecture.status === 'recording'

                  return (
                    <div
                      key={lecture.id}
                      className={`flex items-center gap-3 bg-bg2 border border-border-subtle rounded-xl p-3.5 transition-all hover:border-border-purple ${isUploading ? 'opacity-60' : ''}`}
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
                        {canUpload && (
                          <button
                            onClick={() => handleUploadClick(lecture.id)}
                            disabled={isUploading}
                            className="w-7 h-7 rounded-md bg-bg3 border border-border-subtle flex items-center justify-center text-text2 hover:border-scribia-green/40 hover:bg-scribia-green/8 hover:text-scribia-green transition-all"
                            title="Importar arquivo de áudio"
                          >
                            <Upload className="w-3 h-3" />
                          </button>
                        )}
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
                  )
                })}
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
