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
  const [genProgress, setGenProgress] = useState(lecture.processing_progress)
  const [genError, setGenError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
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
    handleGenerate()
  }

  const handleDownloadMaterial = useCallback(async (storagePath: string, type: string) => {
    setDownloading(type)
    try {
      // If it's already a full URL (signed URL), open directly
      if (storagePath.startsWith('http')) {
        window.open(storagePath, '_blank')
        setDownloading(null)
        return
      }

      // Generate a fresh signed URL from storage path
      const { data, error } = await supabase.storage
        .from('materials')
        .createSignedUrl(storagePath, 3600) // 1 hour

      if (error || !data?.signedUrl) {
        console.error('Failed to create signed URL:', error)
        setGenError(`Erro ao baixar ${type}: ${error?.message ?? 'URL não disponível'}`)
      } else {
        window.open(data.signedUrl, '_blank')
      }
    } catch (e) {
      console.error('Download error:', e)
      setGenError(`Erro ao baixar ${type}`)
    }
    setDownloading(null)
  }, [supabase])

  const handleGenerate = useCallback(async (steps?: string[]) => {
    setGenerating(true)
    setGenError(null)
    setGenProgress(0)
    setCurrentStatus('processing')

    // Verify session exists
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setGenError('Sessão expirada. Faça login novamente.')
      setGenerating(false)
      return
    }
    console.log('Session OK, calling process-lecture with token:', session.access_token.substring(0, 20) + '...')

    // Poll progress while processing
    const pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from('lectures')
        .select('processing_progress, status')
        .eq('id', lecture.id)
        .single()
      if (data) {
        const d = data as { processing_progress: number; status: string }
        setGenProgress(d.processing_progress)
        if (d.status === 'completed') {
          setCurrentStatus('completed')
        }
      }
    }, 3000)

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      const response = await fetch(`${supabaseUrl}/functions/v1/process-lecture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': anonKey ?? '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lecture_id: lecture.id,
          steps: steps ?? ['transcribe', 'summarize', 'ebook', 'playbook'],
        }),
      })

      clearInterval(pollInterval)

      const result = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
      console.log('process-lecture response:', response.status, result)

      if (!response.ok) {
        setGenError(result.error || `Erro ${response.status}`)
        setCurrentStatus('failed')
      } else {
        setGenProgress(100)
        setCurrentStatus('completed')
        router.refresh()
      }
    } catch (e) {
      clearInterval(pollInterval)
      console.error('process-lecture exception:', e)
      setGenError(`Erro: ${e}`)
      setCurrentStatus('failed')
    }

    setGenerating(false)
  }, [supabase, lecture.id, router])

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
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-[24px] font-extrabold text-text">{lecture.title}</h1>
          {lecture.description && (
            <p className="text-[13px] text-text3 mt-1">{lecture.description}</p>
          )}
        </div>
        <LectureStatusBadge status={currentStatus as LectureStatus} />
      </div>

      {/* Metadata cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-bg2 border border-border-subtle rounded-xl p-4">
          <div className="flex items-center gap-2 text-text3 mb-2">
            <User className="w-3.5 h-3.5" />
            <span className="text-[11px] uppercase tracking-wider">Palestrante</span>
          </div>
          <p className="text-[13px] text-text font-medium">{lecture.speakers?.name ?? 'Não atribuído'}</p>
        </div>
        <div className="bg-bg2 border border-border-subtle rounded-xl p-4">
          <div className="flex items-center gap-2 text-text3 mb-2">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-[11px] uppercase tracking-wider">Agendada</span>
          </div>
          <p className="text-[13px] text-text font-medium">{formatDate(lecture.scheduled_at)}</p>
        </div>
        <div className="bg-bg2 border border-border-subtle rounded-xl p-4">
          <div className="flex items-center gap-2 text-text3 mb-2">
            <Mic className="w-3.5 h-3.5" />
            <span className="text-[11px] uppercase tracking-wider">Áudio</span>
          </div>
          <p className="text-[13px] text-text font-medium">
            {audioChunkCount > 0 ? `${audioChunkCount} chunks` : 'Sem áudio'}
          </p>
        </div>
        <div className="bg-bg2 border border-border-subtle rounded-xl p-4">
          <div className="flex items-center gap-2 text-text3 mb-2">
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="text-[11px] uppercase tracking-wider">Progresso</span>
          </div>
          <p className="text-[13px] text-text font-medium">{lecture.processing_progress}%</p>
        </div>
      </div>

      {/* Audio player */}
      {audioUrl && (
        <div className="bg-bg2 border border-border-subtle rounded-2xl p-6">
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

      {!audioUrl && audioChunkCount === 0 && (
        <div className="bg-bg2 border border-border-subtle rounded-2xl p-8 text-center">
          <Mic className="w-8 h-8 text-text3 mx-auto mb-3" />
          <p className="text-[13px] text-text3">Nenhum áudio gravado ainda.</p>
          <p className="text-[11px] text-text3 mt-1">O palestrante precisa gravar pelo app desktop.</p>
        </div>
      )}

      {/* Transcript */}
      {lecture.transcript_text && (
        <div className="bg-bg2 border border-border-subtle rounded-2xl p-6">
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
        <div className="bg-bg2 border border-border-subtle rounded-2xl p-6">
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

      {/* Materials */}
      {(lecture.ebook_url || lecture.playbook_url) && (
        <div className="bg-bg2 border border-border-subtle rounded-2xl p-6">
          <div className="font-heading text-[14px] font-bold text-text mb-3 flex items-center gap-2">
            <Download className="w-4 h-4 text-purple-light" />
            Materiais gerados
          </div>
          <div className="flex gap-3">
            {lecture.ebook_url && (
              <button
                onClick={() => handleDownloadMaterial(lecture.ebook_url!, 'ebook')}
                disabled={downloading === 'ebook'}
                className="inline-flex items-center gap-2 bg-bg3 border border-border-subtle rounded-xl px-4 py-2.5 text-[12px] text-text2 hover:border-border-purple hover:text-purple-light transition-all cursor-pointer disabled:opacity-50"
              >
                {downloading === 'ebook' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
                E-book
              </button>
            )}
            {lecture.playbook_url && (
              <button
                onClick={() => handleDownloadMaterial(lecture.playbook_url!, 'playbook')}
                disabled={downloading === 'playbook'}
                className="inline-flex items-center gap-2 bg-bg3 border border-border-subtle rounded-xl px-4 py-2.5 text-[12px] text-text2 hover:border-border-purple hover:text-purple-light transition-all cursor-pointer disabled:opacity-50"
              >
                {downloading === 'playbook' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                Playbook
              </button>
            )}
          </div>
        </div>
      )}

      {/* AI Generation Card */}
      {audioChunkCount > 0 && (
        <div className="bg-bg2 border border-border-subtle rounded-2xl p-6">
          <div className="font-heading text-[14px] font-bold text-text mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-light" />
            Processamento com IA (Gemini)
          </div>

          {generating && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[12px] text-text2">Processando...</span>
                <span className="text-[12px] text-purple-light font-mono">{genProgress}%</span>
              </div>
              <div className="h-2 bg-bg3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple rounded-full transition-all duration-500"
                  style={{ width: `${genProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-text3 mt-2">
                {genProgress < 25 && 'Transcrevendo áudio...'}
                {genProgress >= 25 && genProgress < 50 && 'Gerando resumo e tópicos...'}
                {genProgress >= 50 && genProgress < 75 && 'Criando e-book...'}
                {genProgress >= 75 && genProgress < 100 && 'Criando playbook...'}
                {genProgress >= 100 && 'Concluído!'}
              </p>
            </div>
          )}

          {genError && (
            <div className="bg-scribia-red/8 border border-scribia-red/20 rounded-xl px-4 py-3 mb-4 text-[12px] text-scribia-red">
              {genError}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {/* Full pipeline */}
            <button
              onClick={() => handleGenerate()}
              disabled={generating}
              className="inline-flex items-center gap-2 bg-purple text-white px-4 py-2.5 rounded-xl text-[12px] font-medium hover:bg-purple-light glow-purple transition-all disabled:opacity-50 cursor-pointer"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {generating ? 'Processando...' : 'Gerar tudo (transcrição + resumo + ebook + playbook)'}
            </button>

            {/* Individual steps */}
            {!generating && lecture.transcript_text && (
              <>
                <button
                  onClick={() => handleGenerate(['summarize'])}
                  className="inline-flex items-center gap-1.5 bg-bg3 border border-border-subtle text-text2 px-3 py-2 rounded-lg text-[11px] hover:border-border-purple hover:text-purple-light transition-all cursor-pointer"
                >
                  <FileText className="w-3 h-3" />
                  Regerar resumo
                </button>
                <button
                  onClick={() => handleGenerate(['ebook'])}
                  className="inline-flex items-center gap-1.5 bg-bg3 border border-border-subtle text-text2 px-3 py-2 rounded-lg text-[11px] hover:border-border-purple hover:text-purple-light transition-all cursor-pointer"
                >
                  <BookOpen className="w-3 h-3" />
                  Regerar e-book
                </button>
                <button
                  onClick={() => handleGenerate(['playbook'])}
                  className="inline-flex items-center gap-1.5 bg-bg3 border border-border-subtle text-text2 px-3 py-2 rounded-lg text-[11px] hover:border-border-purple hover:text-purple-light transition-all cursor-pointer"
                >
                  <FileText className="w-3 h-3" />
                  Regerar playbook
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
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
