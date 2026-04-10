import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../hooks/useTheme'

interface Event {
  id: string
  name: string
  start_date: string
  status: string
}

interface Lecture {
  id: string
  title: string
  status: string
  scheduled_at: string | null
}

interface ImportState {
  lectureId: string
  status: 'idle' | 'uploading' | 'processing' | 'done' | 'error'
  progress: number
  fileName: string
  error: string | null
}

interface EventSelectionProps {
  onSelectLecture: (eventId: string, lectureId: string, lectureTitle: string, eventName: string) => void
  onLogout: () => void
  returnToEventId?: string
  returnToEventName?: string
}

export function EventSelection({ onSelectLecture, onLogout, returnToEventId }: EventSelectionProps) {
  const { cycleTheme, icon: themeIcon, label: themeLabel } = useTheme()
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [loading, setLoading] = useState(true)
  const [importState, setImportState] = useState<ImportState | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importLectureRef = useRef<{ id: string; title: string } | null>(null)

  useEffect(() => {
    async function loadEvents() {
      // Show ALL events (not just active) so organizer can see drafts too
      const { data, error } = await supabase
        .from('events')
        .select('id, name, start_date, status')
        .in('status', ['active', 'draft'])
        .order('start_date', { ascending: false })

      if (error) {
        console.error('Error loading events:', error)
      }
      const loaded = (data ?? []) as Event[]
      setEvents(loaded)
      setLoading(false)

      // Auto-select event when returning from recording
      if (returnToEventId) {
        const returnEvent = loaded.find((e) => e.id === returnToEventId)
        if (returnEvent) {
          selectEvent(returnEvent)
        }
      }
    }
    loadEvents()
  }, [])

  async function selectEvent(event: Event) {
    setSelectedEvent(event)
    const { data } = await supabase
      .from('lectures')
      .select('id, title, status, scheduled_at')
      .eq('event_id', event.id)
      .order('scheduled_at', { ascending: true })
    setLectures((data ?? []) as Lecture[])
  }

  function handleImportClick(lecture: { id: string; title: string }) {
    importLectureRef.current = lecture
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const lecture = importLectureRef.current
    if (!file || !lecture || !selectedEvent) return

    // Reset input so the same file can be re-selected
    e.target.value = ''

    setImportState({ lectureId: lecture.id, status: 'uploading', progress: 0, fileName: file.name, error: null })

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setImportState((s) => s ? { ...s, status: 'error', error: 'Sessão expirada. Faça login novamente.' } : null)
        return
      }

      // Read file as ArrayBuffer for upload
      const arrayBuffer = await file.arrayBuffer()

      setImportState((s) => s ? { ...s, progress: 30 } : null)

      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(`${selectedEvent.id}/${lecture.id}/chunk_0.wav`, arrayBuffer, {
          contentType: file.type || 'audio/wav',
          upsert: true,
        })

      if (uploadError) {
        setImportState((s) => s ? { ...s, status: 'error', error: `Erro no upload: ${uploadError.message}` } : null)
        return
      }

      setImportState((s) => s ? { ...s, progress: 70, status: 'processing' } : null)

      // Get audio duration from file (approximate from file size for non-wav, or use Audio element)
      const audioDuration = await getAudioDuration(file)

      // Update lecture record
      const audioStoragePath = `${selectedEvent.id}/${lecture.id}`
      const { error: dbError } = await supabase
        .from('lectures')
        .update({
          status: 'processing',
          audio_path: audioStoragePath,
          audio_duration_seconds: audioDuration,
          processing_progress: 0,
        } as never)
        .eq('id', lecture.id)

      if (dbError) {
        setImportState((s) => s ? { ...s, status: 'error', error: `Erro ao atualizar palestra: ${dbError.message}` } : null)
        return
      }

      setImportState((s) => s ? { ...s, progress: 85 } : null)

      // Trigger processing pipeline
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
      try {
        await fetch(`${supabaseUrl}/functions/v1/process-lecture`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            lecture_id: lecture.id,
            steps: ['transcribe', 'summarize', 'ebook', 'playbook'],
          }),
        })
      } catch {
        // Processing will be handled by the web panel
      }

      setImportState((s) => s ? { ...s, progress: 100, status: 'done' } : null)

      // Remove lecture from the list after success
      setTimeout(() => {
        setLectures((prev) => prev.filter((l) => l.id !== lecture.id))
        setImportState(null)
      }, 3000)

    } catch (err) {
      setImportState((s) => s ? { ...s, status: 'error', error: `Erro inesperado: ${err}` } : null)
    }
  }

  function getAudioDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      const audio = new Audio()
      audio.addEventListener('loadedmetadata', () => {
        resolve(Math.round(audio.duration))
        URL.revokeObjectURL(audio.src)
      })
      audio.addEventListener('error', () => {
        // Fallback: estimate from file size (rough: ~176KB/s for 16-bit 44.1kHz mono WAV)
        resolve(Math.round(file.size / 176000))
        URL.revokeObjectURL(audio.src)
      })
      audio.src = URL.createObjectURL(file)
    })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
        <div className="logo">SCRIBIA</div>
        <p style={{ color: 'var(--text3)', fontSize: 13 }}>Carregando eventos...</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Top bar */}
      <div className="topbar">
        <div className="logo">SCRIBIA</div>
        <div className="event-info">
          <div className="event-name">
            {selectedEvent ? selectedEvent.name : 'Selecione um evento'}
          </div>
          <div className="event-sub">Desktop Capture</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn-link" onClick={cycleTheme} title={`Tema: ${themeLabel}`}>{themeIcon}</button>
          <button className="btn-link" onClick={onLogout}>Sair</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 28 }}>
        {!selectedEvent ? (
          <div className="animate-fade-up">
            <h2 className="font-heading" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
              Eventos Ativos
            </h2>
            {events.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <p style={{ color: 'var(--text3)', fontSize: 13 }}>Nenhum evento ativo encontrado.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {events.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => selectEvent(event)}
                    className="card"
                    style={{
                      textAlign: 'left',
                      padding: 18,
                      cursor: 'pointer',
                      border: '1px solid var(--border)',
                      background: 'var(--bg2)',
                    }}
                  >
                    <div className="font-heading" style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                      {event.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                      {new Date(event.start_date).toLocaleDateString('pt-BR')}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="animate-fade-up">
            <button
              onClick={() => setSelectedEvent(null)}
              className="btn-link"
              style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              ← Voltar aos eventos
            </button>

            <h2 className="font-heading" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
              Palestras — {selectedEvent.name}
            </h2>

            {/* Hidden file input for audio import */}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              style={{ display: 'none' }}
              onChange={handleFileSelected}
            />

            {/* Import progress banner */}
            {importState && importState.status !== 'idle' && (
              <div style={{
                padding: '14px 18px', marginBottom: 16, borderRadius: 10,
                background: importState.status === 'error'
                  ? 'var(--destructive-dim)'
                  : importState.status === 'done'
                    ? 'var(--success-dim)'
                    : 'var(--primary-dim)',
                border: `1px solid ${
                  importState.status === 'error'
                    ? 'var(--destructive-border)'
                    : importState.status === 'done'
                      ? 'var(--success-border)'
                      : 'var(--primary-ring)'
                }`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                    {importState.status === 'uploading' && 'Enviando áudio...'}
                    {importState.status === 'processing' && 'Processando...'}
                    {importState.status === 'done' && 'Áudio importado com sucesso'}
                    {importState.status === 'error' && 'Erro na importação'}
                  </span>
                  <span className="font-mono" style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {importState.fileName} {importState.status !== 'error' && `· ${importState.progress}%`}
                  </span>
                </div>
                {importState.status !== 'error' ? (
                  <div className="upload-bar">
                    <div className="upload-fill" style={{
                      width: `${importState.progress}%`,
                      background: importState.status === 'done' ? 'var(--green)' : undefined,
                    }} />
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
                    {importState.error}
                    <button
                      onClick={() => setImportState(null)}
                      className="btn btn-ghost btn-sm"
                      style={{ marginLeft: 12, fontSize: 11 }}
                    >
                      Fechar
                    </button>
                  </div>
                )}
              </div>
            )}

            {lectures.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <p style={{ color: 'var(--text3)', fontSize: 13 }}>Nenhuma palestra agendada para gravação.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lectures.map((lecture) => {
                  const isImporting = importState?.lectureId === lecture.id && importState.status !== 'idle'
                  const isProcessing = lecture.status === 'processing'
                  const isCompleted = lecture.status === 'completed'
                  const isDone = isProcessing || isCompleted

                  return (
                    <div
                      key={lecture.id}
                      className="card"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 18,
                        opacity: isImporting ? 0.6 : 1,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="font-heading" style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
                            {lecture.title}
                          </div>
                          {isProcessing && (
                            <span className="chip chip-purple">Processando</span>
                          )}
                          {isCompleted && (
                            <span className="chip chip-green">Concluída</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
                          {lecture.scheduled_at
                            ? new Date(lecture.scheduled_at).toLocaleString('pt-BR')
                            : 'Horário não definido'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {isDone ? (
                          <span style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            ✓ Áudio enviado
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleImportClick(lecture)}
                              className="btn btn-ghost btn-sm"
                              style={{ gap: 6, fontSize: 12 }}
                              disabled={isImporting}
                              title="Importar arquivo de áudio existente"
                            >
                              Importar áudio
                            </button>
                            <button
                              onClick={() => onSelectLecture(selectedEvent.id, lecture.id, lecture.title, selectedEvent.name)}
                              className="btn btn-danger btn-sm"
                              style={{ gap: 6 }}
                              disabled={isImporting}
                            >
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', display: 'inline-block' }} />
                              Gravar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
