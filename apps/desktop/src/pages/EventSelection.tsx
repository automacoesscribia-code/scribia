import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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

interface EventSelectionProps {
  onSelectLecture: (eventId: string, lectureId: string, lectureTitle: string, eventName: string) => void
  onLogout: () => void
}

export function EventSelection({ onSelectLecture, onLogout }: EventSelectionProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [loading, setLoading] = useState(true)

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
      setEvents((data ?? []) as Event[])
      setLoading(false)
    }
    loadEvents()
  }, [])

  async function selectEvent(event: Event) {
    setSelectedEvent(event)
    const { data } = await supabase
      .from('lectures')
      .select('id, title, status, scheduled_at')
      .eq('event_id', event.id)
      .in('status', ['scheduled', 'recording'])
      .order('scheduled_at', { ascending: true })
    setLectures((data ?? []) as Lecture[])
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
        <button className="btn-link" onClick={onLogout}>Sair</button>
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

            {lectures.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <p style={{ color: 'var(--text3)', fontSize: 13 }}>Nenhuma palestra agendada para gravação.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lectures.map((lecture) => (
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
                    <div>
                      <div className="font-heading" style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
                        {lecture.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
                        {lecture.scheduled_at
                          ? new Date(lecture.scheduled_at).toLocaleString('pt-BR')
                          : 'Horário não definido'}
                      </div>
                    </div>
                    <button
                      onClick={() => onSelectLecture(selectedEvent.id, lecture.id, lecture.title, selectedEvent.name)}
                      className="btn btn-danger btn-sm"
                      style={{ gap: 6 }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', display: 'inline-block' }} />
                      Iniciar Gravação
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
