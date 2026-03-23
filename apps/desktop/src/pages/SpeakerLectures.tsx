import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { invoke } from '@tauri-apps/api/core'

interface SpeakerLecture {
  id: string
  title: string
  status: string
  scheduled_at: string | null
  event_id: string
  event_name: string
}

interface LocalChunkInfo {
  exists: boolean
  chunk_count: number
  total_bytes: number
  output_dir: string
}

interface SpeakerLecturesProps {
  userId: string
  userName: string
  onSelectLecture: (eventId: string, lectureId: string, lectureTitle: string, eventName: string) => void
  onLogout: () => void
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'A definir'
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type LectureDisplayStatus = 'scheduled' | 'saved-locally' | 'published'

function getStatusInfo(status: LectureDisplayStatus) {
  switch (status) {
    case 'published':
      return { label: 'Publicado', className: 'status-pill status-online' }
    case 'saved-locally':
      return { label: 'Salvo localmente', className: 'status-pill status-warning' }
    default:
      return { label: 'Agendada', className: 'status-pill status-idle' }
  }
}

export function SpeakerLectures({ userId, userName, onSelectLecture, onLogout }: SpeakerLecturesProps) {
  const [lectures, setLectures] = useState<SpeakerLecture[]>([])
  const [localStatus, setLocalStatus] = useState<Record<string, LocalChunkInfo>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadLectures() {
      // 1. Get speaker record linked to this user
      const { data: speakerData, error: speakerErr } = await supabase
        .from('speakers')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (speakerErr || !speakerData) {
        console.error('No speaker record found for user:', speakerErr)
        setLoading(false)
        return
      }

      // 2. Get lectures assigned to this speaker
      const { data: lectureData, error: lectureErr } = await supabase
        .from('lectures')
        .select('id, title, status, scheduled_at, event_id, events(name)')
        .eq('speaker_id', (speakerData as { id: string }).id)
        .order('scheduled_at', { ascending: true })

      if (lectureErr) {
        console.error('Error loading lectures:', lectureErr)
        setLoading(false)
        return
      }

      const mapped = ((lectureData ?? []) as unknown as Array<{
        id: string; title: string; status: string; scheduled_at: string | null;
        event_id: string; events: { name: string } | null
      }>).map((l) => ({
        id: l.id,
        title: l.title,
        status: l.status,
        scheduled_at: l.scheduled_at,
        event_id: l.event_id,
        event_name: l.events?.name ?? 'Evento',
      }))

      setLectures(mapped)
      setLoading(false)

      // 3. Check local chunks for each lecture
      const statusMap: Record<string, LocalChunkInfo> = {}
      for (const lecture of mapped) {
        try {
          const info = await invoke<LocalChunkInfo>('check_local_chunks', { lectureId: lecture.id, eventId: lecture.event_id })
          statusMap[lecture.id] = info
        } catch {
          statusMap[lecture.id] = { exists: false, chunk_count: 0, total_bytes: 0, output_dir: '' }
        }
      }
      setLocalStatus(statusMap)
    }

    loadLectures()
  }, [userId])

  function getDisplayStatus(lecture: SpeakerLecture): LectureDisplayStatus {
    if (lecture.status === 'completed' || lecture.status === 'processing') return 'published'
    const local = localStatus[lecture.id]
    if (local?.exists && local.chunk_count > 0) return 'saved-locally'
    return 'scheduled'
  }

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
        <div className="logo">SCRIBIA</div>
        <p style={{ color: 'var(--text3)', fontSize: 13 }}>Carregando suas palestras...</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Top bar */}
      <div className="topbar">
        <div className="logo">SCRIBIA</div>
        <div className="event-info">
          <div className="event-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(107,78,255,0.12)', border: '1px solid rgba(107,78,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: 'var(--purple-light)',
            }}>
              {initials}
            </div>
            {userName}
          </div>
          <div className="event-sub">Palestrante</div>
        </div>
        <button className="btn-link" onClick={onLogout}>Sair</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 28 }}>
        <div className="animate-fade-up">
          <h2 className="font-heading" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Minhas Palestras
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
            Selecione uma palestra para iniciar a gravação
          </p>

          {lectures.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>🎤</div>
              <p style={{ color: 'var(--text3)', fontSize: 13 }}>
                Nenhuma palestra atribuída a você ainda.
              </p>
              <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>
                O organizador do evento entrará em contato.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lectures.map((lecture) => {
                const displayStatus = getDisplayStatus(lecture)
                const statusInfo = getStatusInfo(displayStatus)
                const local = localStatus[lecture.id]
                const canRecord = displayStatus !== 'published'

                return (
                  <div
                    key={lecture.id}
                    className="card"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 18,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="font-heading" style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
                          {lecture.title}
                        </div>
                        <span className={statusInfo.className}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, display: 'flex', gap: 12 }}>
                        <span>{lecture.event_name}</span>
                        <span>·</span>
                        <span>{formatDate(lecture.scheduled_at)}</span>
                        {local?.exists && local.chunk_count > 0 && displayStatus === 'saved-locally' && (
                          <>
                            <span>·</span>
                            <span>{local.chunk_count} chunks ({formatBytes(local.total_bytes)})</span>
                          </>
                        )}
                      </div>
                    </div>

                    {canRecord && (
                      <button
                        onClick={() => onSelectLecture(lecture.event_id, lecture.id, lecture.title, lecture.event_name)}
                        className={displayStatus === 'saved-locally' ? 'btn btn-warning btn-sm' : 'btn btn-danger btn-sm'}
                        style={{ gap: 6, whiteSpace: 'nowrap' }}
                      >
                        {displayStatus === 'saved-locally' ? (
                          <>▶ Continuar</>
                        ) : (
                          <>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', display: 'inline-block' }} />
                            Gravar
                          </>
                        )}
                      </button>
                    )}

                    {displayStatus === 'published' && (
                      <span style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        ✓ Publicado
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
