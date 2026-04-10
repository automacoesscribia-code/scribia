import { useState, useEffect, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { supabase } from '../lib/supabase'
import { WaveformCanvas } from '../components/WaveformCanvas'
import { useTheme } from '../hooks/useTheme'

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

interface LocalChunkInfo {
  exists: boolean
  chunk_count: number
  total_bytes: number
  output_dir: string
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
  const { cycleTheme, icon: themeIcon, label: themeLabel } = useTheme()
  const [status, setStatus] = useState<'idle' | 'recording' | 'paused' | 'stopped'>('idle')
  const [duration, setDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [devices, setDevices] = useState<AudioDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<number>(0)
  const [showDeviceSelect, setShowDeviceSelect] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outputDir, setOutputDir] = useState<string>('')
  const [deployStatus, setDeployStatus] = useState<DeployStatus>('none')
  const [deployProgress, setDeployProgress] = useState(0)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const pollRef = useRef<number | null>(null)
  const startTimeRef = useRef<string>('')

  function addLog(msg: string, type: LogEntry['type'] = 'info') {
    const time = new Date().toLocaleTimeString('pt-BR')
    setLogs((prev) => [{ time, msg, type }, ...prev].slice(0, 20))
  }

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

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

    // Check lecture status in DB and local chunks
    async function checkExistingAudio() {
      // 1. Check if lecture was already uploaded/processed in the platform
      try {
        const { data: lecture } = await supabase
          .from('lectures')
          .select('status, audio_duration_seconds')
          .eq('id', lectureId)
          .single()

        if (lecture && (lecture.status === 'processing' || lecture.status === 'completed')) {
          setStatus('stopped')
          setDeployStatus('published')
          setDeployProgress(100)
          if (lecture.audio_duration_seconds) setDuration(lecture.audio_duration_seconds)
          addLog('Áudio já enviado para a plataforma', 'ok')
          addLog(`Status da palestra: ${lecture.status}`, 'info')
          return
        }
      } catch {
        // DB check failed, continue to local check
      }

      // 2. Check for local audio chunks not yet uploaded
      try {
        const info = await invoke<LocalChunkInfo>('check_local_chunks', { lectureId, eventId })
        if (info.exists && info.chunk_count > 0) {
          setStatus('stopped')
          setOutputDir(info.output_dir)
          addLog(`Áudio local encontrado — ${info.chunk_count} chunk(s), ${formatBytes(info.total_bytes)}`, 'ok')
          addLog('Pronto para enviar à plataforma', 'info')
        } else {
          addLog('Aguardando início da gravação', 'info')
        }
      } catch {
        addLog('Aguardando início da gravação', 'info')
      }
    }

    checkExistingAudio()
  }, [])

  const pollStatus = useCallback(() => {
    pollRef.current = window.setInterval(async () => {
      try {
        const s = await invoke<CaptureStatus>('get_capture_status')
        setDuration(Math.floor(s.duration_seconds))
        setAudioLevel(s.audio_level)

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
      addLog(`Gravação contínua — ${formatTime(duration)}`, 'ok')
    }, 30000)
    return () => clearInterval(interval)
  }, [status, duration])

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

      setOutputDir(result.output_dir)
      addLog('Gravação finalizada — áudio salvo localmente', 'ok')
      addLog(`Duração total: ${formatTime(Math.floor(result.duration_seconds))}`, 'info')
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
        addLog(`Upload concluído — áudio completo (${formatBytes(result.total_bytes)})`, 'ok')

        // Update lecture with audio info and set status to processing
        const audioStoragePath = `${eventId}/${lectureId}`
        const updateData: Record<string, unknown> = {
          status: 'processing',
          audio_path: audioStoragePath,
          processing_progress: 0,
        }
        // Only set duration if we have a real value
        if (duration > 0) {
          updateData.audio_duration_seconds = duration
        }

        const { error: dbError } = await supabase
          .from('lectures')
          .update(updateData as never)
          .eq('id', lectureId)

        if (dbError) {
          addLog(`Erro ao atualizar status da palestra: ${dbError.message}`, 'error')
          setError(`Upload OK, mas falha ao atualizar status: ${dbError.message}`)
          setDeployStatus('error')
          return
        }

        setDeployStatus('published')
        addLog('Status da palestra atualizado para processamento', 'ok')

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn-link" onClick={cycleTheme} title={`Tema: ${themeLabel}`}>{themeIcon}</button>
          {status === 'recording' ? (
            <div className="status-dot">
              <div className="dot" />
              Conectado
            </div>
          ) : (
            <button className="btn-link" onClick={onBack}>← Voltar</button>
          )}
        </div>
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
              <div className="rec-indicator" style={{ background: 'var(--warning-muted)', borderColor: 'var(--warning-border)' }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--yellow)', letterSpacing: 1 }}>PAUSADO</span>
              </div>
            )}
            <div className="timer">{formatTime(duration)}</div>
            <div className="timer-sub">
              {status === 'idle' && 'Pronto para gravar'}
              {status === 'recording' && 'Gravação em andamento'}
              {status === 'paused' && 'Gravação pausada'}
              {status === 'stopped' && `Gravação finalizada — ${formatTime(duration)}`}
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
          {status === 'stopped' && deployStatus === 'none' && (
            <div className="card" style={{
              padding: 20,
              background: 'var(--warning-dim)',
              border: '1px solid var(--warning-border)',
              borderRadius: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>☁</span>
                <div className="font-heading" style={{ fontSize: 14, fontWeight: 700, color: 'var(--yellow)' }}>
                  Áudio salvo apenas no seu computador
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', fontSize: 12 }}>
                <div>
                  <span style={{ color: 'var(--text3)' }}>Duração: </span>
                  <span className="font-mono" style={{ color: 'var(--text)' }}>{formatTime(duration)}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text3)' }}>Arquivo: </span>
                  <span style={{ color: 'var(--text)' }}>Áudio completo (WAV)</span>
                </div>
              </div>
              <div style={{
                marginTop: 12, padding: '10px 12px', borderRadius: 6,
                background: 'var(--warning-muted)', fontSize: 12, color: 'var(--text2)', lineHeight: 1.5,
              }}>
                {isOnline
                  ? 'O áudio ainda não foi enviado para a plataforma. Clique em "Enviar para plataforma" abaixo.'
                  : 'Sem conexão com a internet. O áudio está seguro localmente. Envie quando a conexão estabilizar.'}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                <button onClick={handleOpenFolder} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>
                  Abrir pasta
                </button>
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: isOnline ? 'var(--green)' : 'var(--red)',
                    animation: !isOnline ? 'pulse 1.5s infinite' : undefined,
                  }} />
                  <span style={{ color: isOnline ? 'var(--green)' : 'var(--red)' }}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>
          )}
          {status === 'stopped' && deployStatus === 'published' && (
            <div className="card" style={{ padding: 20, background: 'var(--success-dim)', border: '1px solid var(--success-border)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18, color: 'var(--green)' }}>✓</span>
                <div className="font-heading" style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>
                  Áudio enviado com sucesso
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
                Duração: {formatTime(duration)} · O processamento com IA foi iniciado.
              </div>
            </div>
          )}
          {status === 'stopped' && deployStatus === 'error' && (
            <div className="card" style={{ padding: 20, background: 'var(--destructive-dim)', border: '1px solid var(--destructive-border)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>⚠</span>
                <div className="font-heading" style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)' }}>
                  Falha ao enviar
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
                {!isOnline
                  ? 'Sem conexão com a internet. O áudio está seguro localmente. Tente novamente quando a conexão estabilizar.'
                  : 'Ocorreu um erro ao enviar o áudio. Ele está seguro localmente. Tente novamente.'}
              </div>
            </div>
          )}

          {error && <div className="error-msg">{error}</div>}

          {/* Controls */}
          <div className="controls">
            {status === 'idle' && (
              <>
                <button className="btn-ctrl" style={{ width: 40, height: 40, fontSize: 14 }} title="Configurações">⚙</button>
                <button onClick={startRecording} className="btn-rec" title="Iniciar Gravação">
                  <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', display: 'block' }} />
                </button>
                <button className="btn-ctrl" style={{ width: 40, height: 40, fontSize: 14 }} title="Histórico">🕐</button>
              </>
            )}
            {status === 'recording' && (
              <>
                <button
                  onClick={pauseRecording}
                  className="btn-rec"
                  style={{
                    background: 'var(--yellow)',
                    boxShadow: '0 0 24px hsla(38, 92%, 50%, 0.2)',
                  }}
                  title="Pausar"
                >
                  <span style={{ display: 'flex', gap: 4 }}>
                    <span style={{ width: 4, height: 18, borderRadius: 2, background: '#fff' }} />
                    <span style={{ width: 4, height: 18, borderRadius: 2, background: '#fff' }} />
                  </span>
                </button>
                <button
                  onClick={stopRecording}
                  className="btn-rec"
                  style={{
                    width: 52, height: 52,
                    background: 'var(--red)',
                    boxShadow: '0 0 24px hsla(0, 72%, 55%, 0.3)',
                  }}
                  title="Parar gravação"
                >
                  <span style={{ width: 18, height: 18, borderRadius: 3, background: '#fff', display: 'block' }} />
                </button>
              </>
            )}
            {status === 'paused' && (
              <>
                <button
                  onClick={resumeRecording}
                  className="btn-rec"
                  style={{
                    background: 'var(--primary)',
                    boxShadow: 'var(--shadow-elegant)',
                  }}
                  title="Retomar gravação"
                >
                  <span style={{ width: 0, height: 0, borderStyle: 'solid', borderWidth: '10px 0 10px 16px', borderColor: 'transparent transparent transparent #fff', marginLeft: 3 }} />
                </button>
                <button
                  onClick={stopRecording}
                  className="btn-rec"
                  style={{
                    width: 52, height: 52,
                    background: 'var(--red)',
                    boxShadow: '0 0 24px hsla(0, 72%, 55%, 0.3)',
                  }}
                  title="Parar gravação"
                >
                  <span style={{ width: 18, height: 18, borderRadius: 3, background: '#fff', display: 'block' }} />
                </button>
              </>
            )}
            {status === 'stopped' && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {deployStatus === 'none' && (
                  <>
                    <button onClick={handleDeploy} className="btn btn-primary" style={{ gap: 8 }} disabled={!isOnline}>
                      Enviar para plataforma
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
                    <button onClick={handleDeploy} className="btn btn-danger" style={{ gap: 6 }} disabled={!isOnline}>
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
                  ? 'Áudio completo publicado'
                  : 'Enviando áudio completo...'}
              </div>
            </div>
          )}

          {/* Recording status (during recording) */}
          {(status === 'recording' || status === 'paused') && (
            <div className="upload-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11.5, color: 'var(--text2)', fontWeight: 500 }}>Gravação local</span>
                <span className="font-mono" style={{ fontSize: 12, color: 'var(--green)' }}>
                  {formatTime(duration)}
                </span>
              </div>
              <div className="upload-bar">
                <div className="upload-fill" style={{ width: status === 'recording' ? '100%' : '50%', background: status === 'recording' ? 'var(--green)' : 'var(--yellow)' }} />
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 6 }}>
                Gravando áudio contínuo · Salvando localmente
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
