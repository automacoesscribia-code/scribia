'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { Upload, Scissors, AlertTriangle, Loader2, Mic } from 'lucide-react'

interface AudioEditorProps {
  lectureId: string
  eventId: string
  hasAudio: boolean
}

const ACCEPTED_FORMATS = '.mp3,.wav,.webm,.m4a,.ogg'
const MAX_SIZE_MB = 500

export function AudioEditor({ lectureId, eventId, hasAudio }: AudioEditorProps) {
  const [mode, setMode] = useState<'idle' | 'replace' | 'trim'>('idle')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(100)
  const [error, setError] = useState<string | null>(null)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  async function handleFileSelect(file: File) {
    // Validate
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Arquivo muito grande. Máximo: ${MAX_SIZE_MB}MB`)
      return
    }

    if (!confirmReplace && hasAudio) {
      setConfirmReplace(true)
      return
    }

    setUploading(true)
    setUploadProgress(0)
    setError(null)

    try {
      // Backup original if exists
      if (hasAudio) {
        const backupPath = `audio-files/${eventId}/${lectureId}/backup_${Date.now()}.webm`
        const originalPath = `audio-files/${eventId}/${lectureId}/final.webm`

        // Copy original to backup
        const { data: origData } = await supabase.storage
          .from('audio-files')
          .download(originalPath)

        if (origData) {
          await supabase.storage
            .from('audio-files')
            .upload(backupPath, origData, { upsert: true })
        }
      }

      // Upload new file
      const uploadPath = `audio-files/${eventId}/${lectureId}/final.webm`
      setUploadProgress(30)

      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(uploadPath, file, {
          contentType: file.type,
          upsert: true,
        })

      if (uploadError) throw uploadError
      setUploadProgress(70)

      // Reset lecture status and create new processing jobs
      await supabase
        .from('lectures')
        .update({
          status: 'processing',
          processing_progress: 0,
          transcript: null,
          summary: null,
          ebook_content: null,
          playbook_content: null,
        } as never)
        .eq('id', lectureId)

      // Create processing jobs
      const jobTypes = ['transcription', 'summary', 'ebook', 'playbook', 'card']
      for (const type of jobTypes) {
        await supabase
          .from('processing_jobs')
          .insert({
            lecture_id: lectureId,
            type,
            status: 'queued',
          } as never)
      }

      setUploadProgress(100)
      setMode('idle')
      setConfirmReplace(false)
      router.refresh()
    } catch (e) {
      setError(`Erro no upload: ${e}`)
    }
    setUploading(false)
  }

  async function handleTrim() {
    setError('Funcionalidade de trim será implementada com Web Audio API. Por enquanto, substitua o áudio completo.')
  }

  return (
    <div className="bg-bg2 border border-border-subtle rounded-[14px] overflow-hidden animate-fade-up">
      <div className="px-5 py-4 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-purple-light" />
          <h3 className="font-heading text-sm font-bold text-text">Gerenciar Áudio</h3>
        </div>
      </div>

      <div className="p-5">
        {mode === 'idle' && (
          <div className="flex gap-2">
            <button
              onClick={() => setMode('replace')}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-bg3 border border-border-subtle text-[12px] text-text2 hover:border-border-purple hover:text-purple-light transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              Substituir Áudio
            </button>
            <button
              onClick={() => setMode('trim')}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-bg3 border border-border-subtle text-[12px] text-text2 hover:border-border-purple hover:text-purple-light transition-all"
            >
              <Scissors className="w-3.5 h-3.5" />
              Editar (Trim)
            </button>
          </div>
        )}

        {mode === 'replace' && !confirmReplace && (
          <div>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border-subtle rounded-xl p-8 text-center cursor-pointer hover:border-border-purple transition-all"
            >
              <Upload className="w-8 h-8 text-text3 mx-auto mb-2" />
              <p className="text-[13px] text-text2">Clique ou arraste um arquivo de áudio</p>
              <p className="text-[11px] text-text3 mt-1">MP3, WAV, WebM, M4A — máx {MAX_SIZE_MB}MB</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_FORMATS}
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
            <button
              onClick={() => setMode('idle')}
              className="w-full mt-3 text-[12px] text-text3 hover:text-text transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}

        {confirmReplace && (
          <div className="bg-scribia-yellow/8 border border-scribia-yellow/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-scribia-yellow shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] text-text font-medium mb-1">Substituir áudio?</p>
                <p className="text-[12px] text-text3 mb-3">
                  Isso irá reprocessar toda a palestra. O áudio original será mantido como backup.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="px-4 py-1.5 rounded-lg bg-scribia-yellow/20 text-scribia-yellow text-[12px] font-medium hover:bg-scribia-yellow/30 transition-all"
                  >
                    Confirmar e Escolher Arquivo
                  </button>
                  <button
                    onClick={() => { setConfirmReplace(false); setMode('idle') }}
                    className="px-4 py-1.5 rounded-lg bg-bg3 text-text3 text-[12px] hover:text-text transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_FORMATS}
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
          </div>
        )}

        {uploading && (
          <div className="mt-3">
            <div className="flex justify-between mb-1.5">
              <span className="text-[12px] text-text2">Upload</span>
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

        {mode === 'trim' && (
          <div>
            <p className="text-[12px] text-text3 mb-3">
              Selecione os pontos de início e fim para cortar o áudio.
            </p>
            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <label className="block text-[10px] text-text3 uppercase tracking-wider mb-1">Início (%)</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={trimStart}
                  onChange={(e) => setTrimStart(Number(e.target.value))}
                  className="w-full accent-purple"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-text3 uppercase tracking-wider mb-1">Fim (%)</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={trimEnd}
                  onChange={(e) => setTrimEnd(Number(e.target.value))}
                  className="w-full accent-purple"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleTrim}
                className="flex-1 py-2 rounded-lg bg-purple text-white text-[12px] font-medium hover:bg-purple-light glow-purple transition-all"
              >
                Aplicar Trim
              </button>
              <button
                onClick={() => setMode('idle')}
                className="px-4 py-2 rounded-lg bg-bg3 text-text3 text-[12px] hover:text-text transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="text-[11px] text-scribia-red bg-scribia-red/8 border border-scribia-red/20 rounded-lg px-3 py-2 mt-3">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
