'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { RefreshCw } from 'lucide-react'

interface ProcessingJob {
  id: string
  type: string
  status: string
  error_message: string | null
}

interface ProcessingStatusProps {
  lectureId: string
  progress: number
}

const STEPS = [
  { type: 'transcription', label: 'Transcrição' },
  { type: 'summary', label: 'Resumo' },
  { type: 'ebook', label: 'E-book' },
  { type: 'playbook', label: 'Playbook' },
  { type: 'card', label: 'Card' },
] as const

const statusColors: Record<string, string> = {
  queued: 'bg-bg3 border-border-subtle',
  processing: 'bg-purple-dim border-border-purple animate-pulse',
  completed: 'bg-scribia-green/10 border-scribia-green/25',
  failed: 'bg-scribia-red/10 border-scribia-red/25',
}

const statusDotColors: Record<string, string> = {
  queued: 'bg-text3',
  processing: 'bg-purple-light',
  completed: 'bg-scribia-green',
  failed: 'bg-scribia-red',
}

export function ProcessingStatus({ lectureId, progress }: ProcessingStatusProps) {
  const [jobs, setJobs] = useState<ProcessingJob[]>([])
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadJobs() {
      const { data } = await supabase
        .from('processing_jobs')
        .select('id, type, status, error_message')
        .eq('lecture_id', lectureId)
      if (data) setJobs(data as ProcessingJob[])
    }
    loadJobs()

    const channel = supabase
      .channel(`jobs-${lectureId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'processing_jobs',
        filter: `lecture_id=eq.${lectureId}`,
      }, () => loadJobs())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'lectures',
        filter: `id=eq.${lectureId}`,
      }, () => loadJobs())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [lectureId, supabase])

  function getJobStatus(type: string): string {
    return jobs.find((j) => j.type === type)?.status ?? 'queued'
  }

  function getJobError(type: string): string | null {
    return jobs.find((j) => j.type === type)?.error_message ?? null
  }

  async function reprocessStep(type: string) {
    const job = jobs.find((j) => j.type === type)
    if (job) {
      await supabase.from('processing_jobs').update({ status: 'queued', error_message: null, attempt_count: 0 } as never).eq('id', job.id)
    } else {
      await supabase.from('processing_jobs').insert({ lecture_id: lectureId, type, status: 'queued' } as never)
    }
  }

  const allDone = STEPS.every((s) => getJobStatus(s.type) === 'completed')

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1 bg-bg4 rounded-sm overflow-hidden">
          <div
            className="h-full bg-purple transition-all duration-500 rounded-sm"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[12px] font-mono font-medium text-text2">{progress}%</span>
      </div>

      {/* Pipeline steps */}
      <div className="flex gap-2">
        {STEPS.map((step) => {
          const status = getJobStatus(step.type)
          const error = getJobError(step.type)

          return (
            <div
              key={step.type}
              className={`flex-1 rounded-xl border p-3 text-center cursor-pointer transition-all ${statusColors[status] ?? 'bg-bg3 border-border-subtle'}`}
              onClick={() => error && setErrorDetail(errorDetail === error ? null : error)}
            >
              <div className={`w-2.5 h-2.5 rounded-full mx-auto mb-2 ${statusDotColors[status] ?? 'bg-text3'}`} />
              <div className="text-[11px] font-medium text-text2">{step.label}</div>
              {status === 'failed' && (
                <button
                  onClick={(e) => { e.stopPropagation(); reprocessStep(step.type) }}
                  className="inline-flex items-center gap-1 text-[10px] text-purple-light hover:text-purple mt-1.5 transition-colors"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  Retry
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Error detail */}
      {errorDetail && (
        <div className="rounded-lg bg-scribia-red/8 border border-scribia-red/20 p-3 text-[12px] text-scribia-red">
          {errorDetail}
        </div>
      )}

      {/* Completion notification */}
      {allDone && (
        <div className="rounded-lg bg-scribia-green/8 border border-scribia-green/20 p-3 text-[12px] text-scribia-green text-center">
          Processamento concluído! Todos os materiais estão prontos.
        </div>
      )}
    </div>
  )
}
