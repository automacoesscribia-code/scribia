'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FileText, Download, RefreshCw, Loader2 } from 'lucide-react'

interface ReportGeneratorProps {
  eventId: string
  eventStatus: string
}

export function ReportGenerator({ eventId, eventStatus }: ReportGeneratorProps) {
  const [loading, setLoading] = useState(false)
  const [reportReady, setReportReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const isCompleted = eventStatus === 'completed'

  async function generateReport() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('event-report', {
        body: { event_id: eventId },
      })
      if (fnError) throw fnError
      setReportReady(true)
    } catch (e) {
      setError(`Erro ao gerar relatório: ${e}`)
    }
    setLoading(false)
  }

  async function downloadReport(format: 'json' | 'pdf') {
    const path = `materials/${eventId}/report.${format}`
    const { data } = await supabase.storage.from('materials').createSignedUrl(path, 3600)
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
  }

  return (
    <div className="bg-bg2 border border-border-subtle rounded-[14px] p-5 animate-fade-up">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-purple-light" />
          <h3 className="font-heading text-sm font-bold text-text">Relatório Final</h3>
        </div>
        {reportReady && (
          <div className="flex gap-2">
            <button
              onClick={() => downloadReport('json')}
              className="inline-flex items-center gap-1.5 text-[11px] bg-transparent border border-border-subtle text-text2 rounded-lg px-2.5 py-1 hover:border-border-purple hover:text-purple-light transition-all"
            >
              <Download className="w-3 h-3" />
              JSON
            </button>
          </div>
        )}
      </div>

      {!isCompleted && (
        <p className="text-[12px] text-text3 mb-3">
          O relatório final estará disponível quando o evento for marcado como concluído.
        </p>
      )}

      <button
        onClick={generateReport}
        disabled={loading}
        className={`w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
          loading
            ? 'bg-bg3 text-text3 cursor-wait'
            : 'bg-purple text-white hover:bg-purple-light glow-purple'
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Gerando relatório...
          </>
        ) : reportReady ? (
          <>
            <RefreshCw className="w-3.5 h-3.5" />
            Regenerar Relatório
          </>
        ) : (
          <>
            <FileText className="w-3.5 h-3.5" />
            Gerar Relatório Final
          </>
        )}
      </button>

      {error && (
        <div className="text-[11px] text-scribia-red bg-scribia-red/8 border border-scribia-red/20 rounded-lg px-3 py-2 mt-3">
          {error}
        </div>
      )}
    </div>
  )
}
