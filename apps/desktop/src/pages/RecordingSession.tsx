import { useState, useEffect, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { supabase } from '../lib/supabase'
import { WaveformCanvas } from '../components/WaveformCanvas'

interface CaptureStatus {
  state: 'Idle' | 'Recording' | 'Paused' | 'Stopped'
  duration_seconds: number
  audio_level: number
  chunks_saved: number
  output_dir: string
}

interface AudioDevice {
  name: string
  device_type: string
  index: number
}

interface UploadResult {
  success: boolean
  chunks_uploaded: number
  total_bytes: number
  error: string | null
}

interface LogEntry {
  time: string
  msg: string
  type: 'ok' | 'info' | 'warn' | 'error'
}

interface RecordingSessionProps {
  eventId: string
  lectureId: string
  lectureTitle: string
  eventName: string
  onBack: () => void
}

type DeployStatus = 'none' | 'uploading' | 'published' | 'error'

export function RecordingSession({ eventId, lectureId, lectureTitle, eventName, onBack }: RecordingSessionProps) {
  const [status, setStatus] = useState<'idle' | 'recording' | 'paused' | 'stopped'>('idle')
  const [duration, setDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [chunksCount, setChunksCount] = useState(0)
  const [devices, setDevices] = useState<AudioDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<number>(0)
  const [showDeviceSelect, setShowDeviceSelect] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outputDir, setOutputDir] = useState<string>('')
  const [deployStatus, setDeployStatus] = useState<DeployStatus>('none')
  const [deployProgress, setDeployProgress] = useState(0)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const pollRef = useRef<number | null>(null)
  const startTimeRef = useRef<string>('')

  function addLog(msg: string, type: LogEntry['type'] = 'info') {
    const time = new Date().toLocaleTimeString('pt-BR')
    setLogs((prev) => [{ time, msg, type }, ...prev].slice(0, 20))
  }

  useEffect(() => {
    invoke<AudioDevice[]>('list_audio_devices')
      .then((d) => {
        setDevices(d)
        addLog('Dispositivos de áudio detectados', 'ok')
      })
      .catch((e) => {
        setError(`Erro ao listar dispositivos: ${e}`)
        addLog(`Erro: ${e}`, 'error')
      })
    addLog('Aguardando início da gravação', 'info')
  }, [])

  const pollStatus = useCallback(() => {
    pollRef.current = window.setInterval(async () => {
      try {
        const s = await invoke<CaptureStatus>('get_capture_status')
        setDuration(Math.floor(s.duration_seconds))
        setAudioLevel(s.audio_level)
        setChunksCount(s.chunks_saved)
        setOutputDir(s.output_dir)
      } catch {
        // ignore
      }
    }, 500)
  }, [])

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  useEffect(() => {
    if (status !== 'recording') return
    const interval = setInterval(() => {
      addLog(`Chunk ${chunksCount} salvo ✓`, 'ok')
    }, 10000)
    return () => clearInterval(interval)
  }, [status, chunksCount])

  function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  async function startRecording() {
    setError(null)
    try {
      // start_capture now returns the output dir and accepts eventId
      const dir = await invoke<string>('start_capture', {
        deviceIndex: selectedDevice,
        lectureId,
        eventId,
      })
      setOutputDir(dir)
      setStatus('recording')
      startTimeRef.current = new Date().toLocaleTimeString('pt-BR')
      addLog('Sessão iniciada', 'ok')
      addLog(`Dispositivo: ${devices[selectedDevice]?.name}`, 'info')
      addLog(`Salvando em: ${dir}`, 'info')
      pollStatus()
    } catch (e) {
      setError(`Erro ao iniciar gravação: ${e}`)
      addLog(`Erro ao iniciar: ${e}`, 'error')
    }
  }

  async function pauseRecording() {
    try {
      await invoke('pause_capture')
      setStatus('paused')
      addLog('Gravação pausada', 'warn')
    } catch (e) {
      setError(`Erro ao pausar: ${e}`)
    }
  }

  async function resumeRecording() {
    try {
      await invoke('resume_capture')
      setStatus('recording')
      addLog('Gravação retomada', 'ok')
    } catch (e) {
      setError(`Erro ao retomar: ${e}`)
    }
  }

  async function stopRecording() {
    if (!confirm('Finalizar gravação?')) return
    try {
      const result = await invoke<CaptureStatus>('stop_capture')
      if (pollRef.current) clearInterval(pollRef.current)
      setStatus('stopped')
      setDuration(Math.floor(result.duration_seconds))
      setChunksCount(result.chunks_saved)
      setOutputDir(result.output_dir)
      addLog('Gravação finalizada — áudio salvo localmente', 'ok')
      addLog(`Total: ${result.chunks_saved} chunks · ${formatTime(Math.floor(result.duration_seconds))}`, 'info')
      addLog(`Pasta: ${result.output_dir}`, 'info')
    } catch (e) {
      setError(`Erro ao parar: ${e}`)
      addLog(`Erro ao parar: ${e}`, 'error')
    }
  }

  async function handleDeploy() {
    setError(null)
    setDeployStatus('uploading')
    setDeployProgress(0)
    addLog('Iniciando deploy...', 'info')

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''

      // Use the user's access token (NOT the anon key) so RLS policies work
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setDeployStatus('error')
        setError('Sessão expirada. Faça login novamente.')
        addLog('Erro: sessão expirada', 'error')
        return
      }
      const supabaseKey = session.access_token

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setDeployProgress((prev) => Math.min(prev + 5, 90))
      }, 1000)

      const result = await invoke<UploadResult>('upload_chunks', {
        eventId,
        lectureId,
        outputDir,
        supabaseUrl,
        supabaseKey,
      })

      clearInterval(progressInterval)

      if (result.success) {
        setDeployProgress(95)
        setDeployStatus('published')
        addLog(`Deploy concluído — ${result.chunks_uploaded} chunks (${formatBytes(result.total_bytes)})`, 'ok')

        // Update lecture with audio info and set status to processing
        const audioStoragePath = `${eventId}/${lectureId}`
        await supabase
          .from('lectures')
          .update({
            status: 'processing',
            audio_path: audioStoragePath,
            audio_duration_seconds: duration,
            processing_progress: 0,
          } as never)
          .eq('id', lectureId)

        addLog('Metadados do áudio salvos na palestra', 'ok')

        // Auto-trigger processing pipeline
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession()
          if (currentSession) {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
            addLog('Iniciando processamento com IA...', 'info')

            fetch(`${supabaseUrl}/functions/v1/process-lecture`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${currentSession.access_token}`,
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                lecture_id: lectureId,
                steps: ['transcribe', 'summarize', 'ebook', 'playbook'],
              }),
            }).then(async (res) => {
              if (res.ok) {
                addLog('Processamento concluído com sucesso!', 'ok')
              } else {
                const body = await res.json().catch(() => ({}))
                addLog(`Processamento retornou erro: ${body.error ?? res.status}`, 'warn')
              }
            }).catch((e) => {
              addLog(`Erro ao chamar processamento: ${e}`, 'warn')
            })
          }
        } catch {
          addLog('Processamento será feito pelo painel web', 'info')
        }

        setDeployProgress(100)
        addLog('Status atualizado: processamento iniciado', 'ok')
      } else {
        setDeployStatus('error')
        setError(result.error || 'Erro desconhecido no upload')
        addLog(`Deploy falhou: ${result.error}`, 'error')
      }
    } catch (e) {
      setDeployStatus('error')
      setError(`Erro no deploy: ${e}`)
      setDeployProgress(0)
      addLog(`Erro no deploy: ${e}`, 'error')
    }
  }

  async function handleOpenFolder() {
    try {
      await invoke('open_folder', { path: outputDir })
    } catch (e) {
      addLog(`Erro ao abrir pasta: ${e}`, 'error')
    }
  }

  const recordingPct = status === 'recording' ? Math.min(95, Math.round((chunksCount / Math.max(chunksCount + 1, 1)) * 100)) : 0
  const deviceInfo = devices[selectedDevice]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Window Chrome */}
      <div className="window-chrome">
        <div className="traffic-lights">
          <div className="tl tl-red" />
          <div className="tl tl-yellow" />
          <div className="tl tl-green" />
        </div>
        <div className="window-title">ScribIA Desktop · v2.1.4</div>
      </div>

      {/* Top Bar */}
      <div className="topbar">
        <div className="logo">SCRIBIA</div>
        <div className="event-info">
          <div className="event-name">{eventName}</div>
          <div className="event-sub">{lectureTitle}</div>
        </div>
        {status === 'recording' ? (
          <div className="status-dot">
            <div className="dot" />
            Conectado
          </div>
        ) : (
          <button className="btn-link" onClick={onBack}>← Voltar</button>
        )}
      </div>

      {/* Main Grid */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 280px', padding: 28, gap: 24 }}>

        {/* LEFT: Recorder */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="animate-fade-up">

          {/* Timer */}
          <div className="timer-display">
            {status === 'recording' && (
              <div className="rec-indicator">
                <div className="rec-dot" />
                <span className="rec-label">REC</span>
              </div>
            )}
            {status === 'paused' && (
              <div className="rec-indicator" style={{ background: 'rgba(255,184,48,0.1)', borderColor: 'rgba(255,184,48,0.25)' }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--yellow)', letterSpacing: 1 }}>PAUSADO</span>
              </div>
            )}
            <div className="timer">{formatTime(duration)}</div>
            <div className="timer-sub">
              {status === 'idle' && 'Pronto para gravar'}
              {status === 'recording' && 'Gravação em andamento'}
              {status === 'paused' && 'Gravação pausada'}
              {status === 'stopped' && `Gravação finalizada — ${chunksCount} chunks`}
            </div>
          </div>

          {/* Waveform Canvas */}
          <WaveformCanvas
            isActive={status === 'recording'}
            audioLevel={audioLevel}
          />

          {/* Device Selector — only when idle */}
          {(status === 'idle' || status === 'recording' || status === 'paused') && (
            <div className="device-row">
              <div className="device-icon">🎙</div>
              <div className="device-info">
                <div className="device-name">{deviceInfo?.name ?? 'Selecione um dispositivo'}</div>
                <div className="device-sub">
                  {deviceInfo ? `${deviceInfo.device_type} · Entrada de áudio` : 'Nenhum dispositivo'}
                </div>
              </div>
              {status === 'idle' ? (
                showDeviceSelect ? (
                  <select
                    value={selectedDevice}
                    onChange={(e) => { setSelectedDevice(Number(e.target.value)); setShowDeviceSelect(false) }}
                    onBlur={() => setShowDeviceSelect(false)}
                    className="select"
                    style={{ minWidth: 200 }}
                    autoFocus
                  >
                    {devices.map((d) => (
                      <option key={d.index} value={d.index}>{d.name}</option>
                    ))}
                  </select>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowDeviceSelect(true)}>
                    Trocar
                  </button>
                )
              ) : null}
            </div>
          )}

          {/* Post-recording summary panel */}
          {status === 'stopped' && (
            <div className="card" style={{ padding: 20, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="font-heading" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
                Áudio salvo localmente
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', fontSize: 12 }}>
                <div>
                  <span style={{ color: 'var(--text3)' }}>Duração: </span>
                  <span className="font-mono" style={{ color: 'var(--text)' }}>{formatTime(duration)}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text3)' }}>Chunks: </span>
                  <span style={{ color: 'var(--text)' }}>{chunksCount}</span>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: 'var(--text3)' }}>Pasta: </span>
                  <span style={{ color: 'var(--text2)', fontSize: 11, wordBreak: 'break-all' }}>{outputDir}</span>
                </div>
              </div>
              <button
                onClick={handleOpenFolder}
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 12, fontSize: 11 }}
              >
                📂 Abrir pasta
              </button>
            </div>
          )}

          {error && <div className="error-msg">{error}</div>}

          {/* Controls */}
          <div className="controls">
            {status === 'idle' && (
              <>
                <button className="btn-ctrl" style={{ width: 40, height: 40, fontSize: 14 }} title="Configurações">⚙</button>
                <button className="btn-ctrl" style={{ opacity: 0.3, cursor: 'default' }} title="Pausar">⏸</button>
                <button onClick={startRecording} className="btn-rec" title="Iniciar Gravação">
                  <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', display: 'block' }} />
                </button>
                <button className="btn-ctrl" style={{ opacity: 0.3, cursor: 'default' }} title="Parar">■</button>
                <button className="btn-ctrl" style={{ width: 40, height: 40, fontSize: 14 }} title="Histórico">🕐</button>
              </>
            )}
            {status === 'recording' && (
              <>
                <button className="btn-ctrl" style={{ width: 40, height: 40, fontSize: 14 }} title="Configurações">⚙</button>
                <button onClick={pauseRecording} className="btn-ctrl" title="Pausar">⏸</button>
                <div className="btn-rec" style={{ background: 'var(--red)', boxShadow: '0 0 24px rgba(255,77,106,0.3)', cursor: 'default' }}>
                  <div className="rec-dot" style={{ width: 12, height: 12 }} />
                </div>
                <button onClick={stopRecording} className="btn-ctrl" style={{ background: 'rgba(255,77,106,0.1)', borderColor: 'rgba(255,77,106,0.3)', color: 'var(--red)' }} title="Parar">■</button>
                <button className="btn-ctrl" style={{ width: 40, height: 40, fontSize: 14 }} title="Histórico">🕐</button>
              </>
            )}
            {status === 'paused' && (
              <>
                <button className="btn-ctrl" style={{ width: 40, height: 40, fontSize: 14 }}>⚙</button>
                <button onClick={resumeRecording} className="btn-ctrl" style={{ background: 'rgba(0,212,160,0.1)', borderColor: 'rgba(0,212,160,0.3)', color: 'var(--green)' }} title="Retomar">▶</button>
                <div className="btn-rec" style={{ background: 'var(--yellow)', boxShadow: '0 0 24px rgba(255,184,48,0.2)', cursor: 'default' }}>
                  <span style={{ fontSize: 20 }}>⏸</span>
                </div>
                <button onClick={stopRecording} className="btn-ctrl" style={{ background: 'rgba(255,77,106,0.1)', borderColor: 'rgba(255,77,106,0.3)', color: 'var(--red)' }} title="Parar">■</button>
                <button className="btn-ctrl" style={{ width: 40, height: 40, fontSize: 14 }}>🕐</button>
              </>
            )}
            {status === 'stopped' && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {deployStatus === 'none' && (
                  <>
                    <button onClick={handleDeploy} className="btn btn-primary" style={{ gap: 8 }}>
                      🚀 Deploy
                    </button>
                    <button onClick={onBack} className="btn btn-ghost">
                      Voltar
                    </button>
                  </>
                )}
                {deployStatus === 'uploading' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--purple-light)' }}>
                    <span>Enviando...</span>
                  </div>
                )}
                {deployStatus === 'published' && (
                  <>
                    <span style={{ fontSize: 13, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      ✓ Publicado
                    </span>
                    <button onClick={onBack} className="btn btn-ghost">
                      Voltar
                    </button>
                  </>
                )}
                {deployStatus === 'error' && (
                  <>
                    <button onClick={handleDeploy} className="btn btn-danger" style={{ gap: 6 }}>
                      ↻ Tentar novamente
                    </button>
                    <button onClick={onBack} className="btn btn-ghost">
                      Voltar
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="animate-fade-up">

          {/* Metadata */}
          <div className="info-card">
            <div className="info-card-header">Metadados da sessão</div>
            <div>
              <div className="info-row">
                <div className="info-row-label">Evento</div>
                <div className="info-row-value">{eventName}</div>
              </div>
              <div className="info-row">
                <div className="info-row-label">Palestra</div>
                <div className="info-row-value">{lectureTitle}</div>
              </div>
              <div className="info-row">
                <div className="info-row-label">Dispositivo</div>
                <div className="info-row-value">{deviceInfo?.name ?? '—'}</div>
              </div>
              <div className="info-row">
                <div className="info-row-label">Início</div>
                <div className="info-row-value">{startTimeRef.current || '—'}</div>
              </div>
              <div className="info-row">
                <div className="info-row-label">Duração</div>
                <div className="info-row-value font-mono">{formatTime(duration)}</div>
              </div>
            </div>
          </div>

          {/* Deploy Progress */}
          {(deployStatus === 'uploading' || deployStatus === 'published') && (
            <div className="upload-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11.5, color: 'var(--text2)', fontWeight: 500 }}>Deploy</span>
                <span className="font-mono" style={{ fontSize: 12, color: deployStatus === 'published' ? 'var(--green)' : 'var(--purple-light)' }}>
                  {deployStatus === 'published' ? 'Concluído ✓' : `${deployProgress}%`}
                </span>
              </div>
              <div className="upload-bar">
                <div className="upload-fill" style={{ width: `${deployProgress}%` }} />
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 6 }}>
                {deployStatus === 'published'
                  ? `${chunksCount} chunks publicados`
                  : `Enviando chunk ${Math.ceil(chunksCount * deployProgress / 100)} de ${chunksCount}...`}
              </div>
            </div>
          )}

          {/* Recording status (during recording) */}
          {(status === 'recording' || status === 'paused') && (
            <div className="upload-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11.5, color: 'var(--text2)', fontWeight: 500 }}>Gravação local</span>
                <span className="font-mono" style={{ fontSize: 12, color: 'var(--green)' }}>
                  {chunksCount} chunks
                </span>
              </div>
              <div className="upload-bar">
                <div className="upload-fill" style={{ width: `${recordingPct}%`, background: 'var(--green)' }} />
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 6 }}>
                Salvando na pasta do app
              </div>
            </div>
          )}

          {/* System Log */}
          <div className="info-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="info-card-header">Log do sistema</div>
            <div className="log-body" style={{ flex: 1, overflowY: 'auto', maxHeight: 240 }}>
              {logs.map((entry, i) => (
                <div key={i} className="log-line">
                  <span className="log-time">{entry.time}</span>
                  <span className={`log-${entry.type}`}>{entry.msg}</span>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="log-line">
                  <span className="log-time">—</span>
                  <span className="log-info">Sistema pronto</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
