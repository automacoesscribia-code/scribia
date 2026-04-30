'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { LectureStatusBadge } from './lecture-status-badge'
import type { LectureStatus } from '@scribia/shared'
import {
  Play,
  Pause,
  CheckCircle,
  RefreshCw,
  FileText,
  BookOpen,
  Download,
  Clock,
  Mic,
  User,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { ProfileSelection, DEFAULT_PROFILES } from './profile-selection'
import { ProfileMaterialsView } from './profile-materials-view'
import { AudioEditor } from './audio-editor'

interface LectureData {
  id: string
  title: string
  description: string | null
  status: string
  scheduled_at: string | null
  duration_seconds: number | null
  audio_path: string | null
  audio_duration_seconds: number | null
  transcript_text: string | null
  summary: string | null
  topics: string[] | null
  ebook_url: string | null
  playbook_url: string | null
  card_image_url: string | null
  processing_progress: number
  event_id: string
  speaker_id: string | null
  speakers: { name: string; email: string | null } | null
  events: { id: string; name: string } | null
}

interface Props {
  lecture: LectureData
  audioUrl: string | null
  audioChunkCount: number
  eventId: string
}

export function LectureDetailClient({ lecture, audioUrl, audioChunkCount, eventId }: Props) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentStatus, setCurrentStatus] = useState(lecture.status)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [activeStep, setActiveStep] = useState<string | null>(null)
  const [genProgress, setGenProgress] = useState(lecture.processing_progress)
  const [genError, setGenError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>(DEFAULT_PROFILES)
  const [stepsDone, setStepsDone] = useState<Record<string, boolean>>({
    transcribe: !!lecture.transcript_text,
    summarize: !!lecture.summary,
    ebook: !!lecture.ebook_url,
    playbook: !!lecture.playbook_url,
  })
  const router = useRouter()
  const supabase = createClient()

  const handleMarkComplete = useCallback(async () => {
    setLoading(true)
    await supabase
      .from('lectures')
      .update({ status: 'completed', processing_progress: 100 } as never)
      .eq('id', lecture.id)
    setCurrentStatus('completed')
    setLoading(false)
    router.refresh()
  }, [supabase, lecture.id, router])

  const handleReprocess = async () => {
    // Reset status and trigger full processing pipeline
    setLoading(true)
    await supabase
      .from('lectures')
      .update({ status: 'processing', processing_progress: 0 } as never)
      .eq('id', lecture.id)
    setCurrentStatus('processing')
    setLoading(false)
    // Trigger the actual processing
    handleGenerateAll()
  }

  const handleDownloadMaterial = useCallback(async (_storagePath: string, type: string) => {
    setDownloading(type)
    try {
      // Use API route that serves HTML with correct content-type
      window.open(`/api/materials/${lecture.id}?type=${type}`, '_blank')
    } catch (e) {
      console.error('Download error:', e)
      setGenError(`Erro ao baixar ${type}`)
    }
    setDownloading(null)
  }, [lecture.id])

  const getSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Sessão expirada. Faça login novamente.')
    return session
  }, [supabase])

  const callProcessLecture = useCallback(async (session: { access_token: string }, body: Record<string, unknown>) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const res = await fetch(`${supabaseUrl}/functions/v1/process-lecture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': anonKey ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    if (!res.ok) {
      if (res.status === 546) throw new Error('Timeout: a geração demorou demais. Tente novamente.')
      throw new Error(data.error || `Erro ${res.status}`)
    }
    return data
  }, [])

  const handleTranscribe = useCallback(async () => {
    setGenerating(true)
    setActiveStep('transcribe')
    setGenError(null)
    setCurrentStatus('processing')
    try {
      const session = await getSession()
      let chunkStart = 0
      let hasMore = true
      let totalChunks = audioChunkCount || 100

      while (hasMore) {
        console.log(`Transcribing chunk ${chunkStart + 1}...`)
        setGenProgress(Math.round((chunkStart / totalChunks) * 100))
        const result = await callProcessLecture(session, {
          lecture_id: lecture.id,
          steps: ['transcribe'],
          chunk_start: chunkStart,
          chunk_end: chunkStart + 1, // 1 chunk per call
        })
        console.log('transcribe result:', result)
        if (result.total_chunks) totalChunks = result.total_chunks

        if (result.partial) {
          chunkStart = result.next_chunk_start
        } else {
          hasMore = false
        }
      }

      setGenProgress(100)
      setStepsDone(prev => ({ ...prev, transcribe: true }))
      setCurrentStatus('processing')
      // Reload to show updated data from server
      window.location.reload()
    } catch (e) {
      console.error('transcribe error:', e)
      setGenError(`Transcrição: ${e instanceof Error ? e.message : e}`)
      setCurrentStatus('failed')
    }
    setGenerating(false)
    setActiveStep(null)
  }, [getSession, callProcessLecture, lecture.id, audioChunkCount])

  const handleSummarize = useCallback(async () => {
    setGenerating(true)
    setActiveStep('summarize')
    setGenError(null)
    setGenProgress(0)
    setCurrentStatus('processing')
    try {
      const session = await getSession()
      let chunkStart = 0
      let hasMore = true

      while (hasMore) {
        console.log(`Summarizing chunk ${chunkStart}...`)
        setGenProgress(Math.round((chunkStart / Math.max(chunkStart + 1, 1)) * 80))
        const result = await callProcessLecture(session, {
          lecture_id: lecture.id,
          steps: ['summarize'],
          chunk_start: chunkStart,
        })
        console.log('summarize result:', result)

        if (result.partial) {
          chunkStart = result.next_chunk_start
          setGenProgress(Math.round((chunkStart / result.total_chunks) * 80))
        } else {
          hasMore = false
        }
      }

      setGenProgress(100)
      setStepsDone(prev => ({ ...prev, summarize: true }))
      window.location.reload()
    } catch (e) {
      console.error('summarize error:', e)
      setGenError(`Resumo: ${e instanceof Error ? e.message : e}`)
      setCurrentStatus('failed')
    }
    setGenerating(false)
    setActiveStep(null)
  }, [getSession, callProcessLecture, lecture.id])

  const handleGenerateProfiles = useCallback(async () => {
    // Build queue locally from selected profiles — no backend round-trip needed
    const profilesToUse = selectedProfiles.length > 0 ? selectedProfiles : DEFAULT_PROFILES
    const queue: Array<{ profileType: string; contentType: 'ebook' | 'playbook' }> = []
    for (const profile of profilesToUse) {
      queue.push({ profileType: profile, contentType: 'ebook' })
      queue.push({ profileType: profile, contentType: 'playbook' })
    }

    setGenerating(true)
    setActiveStep('ebook')
    setGenError(null)
    setGenProgress(0)
    setCurrentStatus('processing')
    try {
      const session = await getSession()

      // Iterate through queue: one call per profile/type
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i]
        console.log(`Generating: ${item.profileType} / ${item.contentType} (${i + 1}/${queue.length})...`)
        setActiveStep(item.contentType === 'ebook' ? 'ebook' : 'playbook')

        const result = await callProcessLecture(session, {
          lecture_id: lecture.id,
          steps: ['generate_profile'],
          profile_type: item.profileType,
          content_type: item.contentType,
          selected_profiles: profilesToUse,
        })

        setGenProgress(Math.round(((i + 1) / queue.length) * 100))

        if (!result.success && result.profile_result?.error) {
          console.warn(`Warning: ${item.profileType}/${item.contentType} failed:`, result.profile_result.error)
        }
      }

      setGenProgress(100)
      setStepsDone(prev => ({ ...prev, ebook: true, playbook: true }))
      setCurrentStatus('completed')
      window.location.reload()
    } catch (e) {
      console.error('Profile generation error:', e)
      setGenError(`Geracao de livebooks: ${e instanceof Error ? e.message : e}`)
      setCurrentStatus('failed')
    }
    setGenerating(false)
    setActiveStep(null)
  }, [getSession, callProcessLecture, lecture.id, selectedProfiles])

  const handleGenerateAll = useCallback(async () => {
    setGenError(null)

    if (!stepsDone.transcribe) {
      await handleTranscribe()
      if (genError) return
    }

    if (!stepsDone.summarize) {
      await handleSummarize()
      if (genError) return
    }

    // Use multi-profile pipeline
    await handleGenerateProfiles()
  }, [stepsDone, handleTranscribe, handleSummarize, handleGenerateProfiles, genError])

  function formatDuration(seconds: number | null): string {
    if (!seconds) return '—'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}min ${s}s`
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'Não agendada'
    return new Date(dateStr).toLocaleString('pt-BR')
  }

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-[20px] sm:text-[22px] md:text-[24px] font-extrabold text-text leading-tight break-words">{lecture.title}</h1>
          {lecture.description && (
            <p className="text-[13px] text-text3 mt-1">{lecture.description}</p>
          )}
        </div>
        <div className="shrink-0">
          <LectureStatusBadge status={currentStatus as LectureStatus} />
        </div>
      </div>

      {/* Metadata cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-bg2 border border-border-subtle rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 text-text3 mb-2">
            <User className="w-3.5 h-3.5" />
            <span className="text-[11px] uppercase tracking-wider">Palestrante</span>
          </div>
          <p className="text-[13px] text-text font-medium">{lecture.speakers?.name ?? 'Não atribuído'}</p>
        </div>
        <div className="bg-bg2 border border-border-subtle rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 text-text3 mb-2">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-[11px] uppercase tracking-wider">Agendada</span>
          </div>
          <p className="text-[13px] text-text font-medium">{formatDate(lecture.scheduled_at)}</p>
        </div>
        <div className="bg-bg2 border border-border-subtle rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 text-text3 mb-2">
            <Mic className="w-3.5 h-3.5" />
            <span className="text-[11px] uppercase tracking-wider">Áudio</span>
          </div>
          <p className="text-[13px] text-text font-medium">
            {audioChunkCount > 0 ? `${audioChunkCount} chunks` : 'Sem áudio'}
          </p>
        </div>
        <div className="bg-bg2 border border-border-subtle rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 text-text3 mb-2">
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="text-[11px] uppercase tracking-wider">Progresso</span>
          </div>
          <p className="text-[13px] text-text font-medium">{lecture.processing_progress}%</p>
        </div>
      </div>

      {/* Audio player */}
      {audioUrl && (
        <div className="bg-bg2 border border-border-subtle rounded-2xl p-4 sm:p-6">
          <div className="font-heading text-[14px] font-bold text-text mb-4 flex items-center gap-2">
            <Mic className="w-4 h-4 text-purple-light" />
            Áudio da palestra
          </div>
          <audio
            src={audioUrl}
            controls
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            className="w-full"
            style={{ filter: 'invert(1) hue-rotate(180deg)', opacity: 0.8 }}
          />
          <p className="text-[11px] text-text3 mt-2">
            {audioChunkCount} chunks concatenados · Duração estimada: {formatDuration(lecture.audio_duration_seconds)}
          </p>
        </div>
      )}

      {/* Audio editor: manage/replace/delete */}
      {audioChunkCount > 0 && (
        <AudioEditor
          lectureId={lecture.id}
          eventId={lecture.event_id}
          hasAudio={audioChunkCount > 0}
          onAudioDeleted={() => window.location.reload()}
        />
      )}

      {!audioUrl && audioChunkCount === 0 && (
        <div className="bg-bg2 border border-border-subtle rounded-2xl p-6 sm:p-8 text-center">
          <Mic className="w-8 h-8 text-text3 mx-auto mb-3" />
          <p className="text-[13px] text-text3">Nenhum áudio gravado ainda.</p>
          <p className="text-[11px] text-text3 mt-1">O palestrante precisa gravar pelo app desktop ou faça upload manualmente.</p>
          <div className="mt-4">
            <AudioEditor
              lectureId={lecture.id}
              eventId={lecture.event_id}
              hasAudio={false}
            />
          </div>
        </div>
      )}

      {/* Transcript */}
      {lecture.transcript_text && (
        <div className="bg-bg2 border border-border-subtle rounded-2xl p-4 sm:p-6">
          <div className="font-heading text-[14px] font-bold text-text mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-light" />
            Transcrição
          </div>
          <div className="bg-bg3 border border-border-subtle rounded-xl p-4 max-h-64 overflow-y-auto">
            <p className="text-[13px] text-text2 leading-relaxed whitespace-pre-wrap">
              {lecture.transcript_text}
            </p>
          </div>
        </div>
      )}

      {/* Summary + Topics */}
      {lecture.summary && (
        <div className="bg-bg2 border border-border-subtle rounded-2xl p-4 sm:p-6">
          <div className="font-heading text-[14px] font-bold text-text mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-light" />
            Resumo
          </div>
          <p className="text-[13px] text-text2 leading-relaxed">{lecture.summary}</p>
          {lecture.topics && lecture.topics.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {lecture.topics.map((topic, i) => (
                <span key={i} className="bg-purple-dim border border-border-purple rounded-full px-3 py-1 text-[11px] text-purple-light">
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Unified AI Processing Card */}
      {audioChunkCount > 0 && (
        <div className="bg-bg2 border border-border-subtle rounded-2xl p-4 sm:p-6">
          <div className="font-heading text-[14px] font-bold text-text mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-light" />
            Processamento com IA
          </div>

          {/* Progress bar */}
          {generating && activeStep && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[12px] text-text2">
                  {activeStep === 'transcribe' && 'Transcrevendo audio...'}
                  {activeStep === 'summarize' && 'Gerando resumo...'}
                  {activeStep === 'ebook' && 'Gerando livebooks...'}
                  {activeStep === 'playbook' && 'Gerando livebooks...'}
                </span>
                <span className="text-[12px] text-purple-light font-mono">{genProgress}%</span>
              </div>
              <div className="h-2 bg-bg3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple rounded-full transition-all duration-500"
                  style={{ width: `${genProgress}%` }}
                />
              </div>
            </div>
          )}

          {genError && (
            <div className="bg-scribia-red/8 border border-scribia-red/20 rounded-xl px-4 py-3 mb-4 text-[12px] text-scribia-red">
              {genError}
            </div>
          )}

          {/* Step 1 & 2: Transcription + Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
            <button
              onClick={handleTranscribe}
              disabled={generating}
              className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl text-[12px] font-medium transition-all cursor-pointer disabled:opacity-50 text-left ${
                stepsDone.transcribe
                  ? 'bg-scribia-green/10 border border-scribia-green/30 text-scribia-green'
                  : 'bg-purple/10 border border-purple/30 text-purple-light hover:bg-purple/20'
              }`}
            >
              {activeStep === 'transcribe' ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : stepsDone.transcribe ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <Mic className="w-4 h-4 shrink-0" />
              )}
              <div>
                <div>{stepsDone.transcribe ? 'Transcricao concluida' : 'Gerar transcricao'}</div>
                <div className="text-[10px] opacity-70">{audioChunkCount} chunks de audio</div>
              </div>
            </button>

            <button
              onClick={handleSummarize}
              disabled={generating || !stepsDone.transcribe}
              className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl text-[12px] font-medium transition-all cursor-pointer disabled:opacity-50 text-left ${
                stepsDone.summarize
                  ? 'bg-scribia-green/10 border border-scribia-green/30 text-scribia-green'
                  : stepsDone.transcribe
                    ? 'bg-purple/10 border border-purple/30 text-purple-light hover:bg-purple/20'
                    : 'bg-bg3 border border-border-subtle text-text3'
              }`}
            >
              {activeStep === 'summarize' ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : stepsDone.summarize ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <FileText className="w-4 h-4 shrink-0" />
              )}
              <div>
                <div>{stepsDone.summarize ? 'Resumo concluido' : 'Gerar resumo'}</div>
                <div className="text-[10px] opacity-70">Resumo + topicos da palestra</div>
              </div>
            </button>
          </div>

          {/* Divider: Livebook Configuration (only visible after summary) */}
          {stepsDone.summarize && (
            <>
              <div className="border-t border-border-subtle my-4" />
              <div className="text-[12px] text-text3 uppercase tracking-wider mb-3">Configuracao dos Livebooks</div>

              {/* Profile Selection — inline */}
              <ProfileSelection
                lectureId={lecture.id}
                eventId={eventId}
                disabled={generating}
                onProfilesLoaded={setSelectedProfiles}
              />

              {/* Generate button */}
              <div className="mt-5">
                <button
                  onClick={handleGenerateAll}
                  disabled={generating || selectedProfiles.length === 0}
                  className="w-full inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-purple to-purple-light text-white px-5 py-3.5 rounded-xl text-[13px] font-semibold shadow-md hover:shadow-lg hover:brightness-110 disabled:opacity-40 disabled:shadow-none transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  {generating && (activeStep === 'ebook' || activeStep === 'playbook') ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {generating ? 'Gerando...' : `Gerar Livebooks (${selectedProfiles.length} ${selectedProfiles.length === 1 ? 'perfil' : 'perfis'})`}
                </button>
              </div>

              {/* Profile Materials — inline results */}
              <div className="mt-4">
                <ProfileMaterialsView
                  lectureId={lecture.id}
                  selectedProfiles={selectedProfiles}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 sm:gap-3 pt-2">
        {(currentStatus === 'processing' || currentStatus === 'scheduled' || currentStatus === 'recording') && audioChunkCount > 0 && (
          <button
            onClick={handleMarkComplete}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-scribia-green text-white px-5 py-2.5 rounded-xl text-[13px] font-medium hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            {loading ? 'Salvando...' : 'Marcar como Concluída'}
          </button>
        )}

        {currentStatus === 'completed' && (
          <button
            onClick={handleReprocess}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-scribia-yellow/15 border border-scribia-yellow/30 text-scribia-yellow px-5 py-2.5 rounded-xl text-[13px] font-medium hover:bg-scribia-yellow/25 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            {loading ? 'Reprocessando...' : 'Reprocessar'}
          </button>
        )}

        {currentStatus === 'failed' && (
          <button
            onClick={handleReprocess}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-scribia-red/15 border border-scribia-red/30 text-scribia-red px-5 py-2.5 rounded-xl text-[13px] font-medium hover:bg-scribia-red/25 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            {loading ? 'Reprocessando...' : 'Tentar novamente'}
          </button>
        )}
      </div>
    </div>
  )
}
