import { useEffect, useRef } from 'react'

interface WaveformCanvasProps {
  isActive: boolean
  audioLevel: number
}

export function WaveformCanvas({ isActive, audioLevel }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tRef = useRef(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = 80 * dpr
    ctx.scale(dpr, dpr)

    const bars = 80
    const barW = rect.width / bars

    function draw() {
      if (!ctx || !canvas) return
      const width = rect.width
      ctx.clearRect(0, 0, width, 80)

      for (let i = 0; i < bars; i++) {
        const x = i * barW
        const levelFactor = isActive ? (audioLevel / 100) * 0.8 + 0.2 : 0.15

        const noise =
          Math.sin(i * 0.4 + tRef.current) * 0.5 +
          Math.sin(i * 0.8 + tRef.current * 1.3) * 0.3 +
          (isActive ? Math.random() * 0.2 : 0)

        const amp = Math.abs(noise) * 28 * levelFactor + 4
        const alpha = isActive
          ? 0.4 + Math.abs(noise) * 0.6
          : 0.15 + Math.abs(noise) * 0.15

        ctx.fillStyle = `hsla(249,45%,55%,${alpha})`
        ctx.beginPath()
        ctx.roundRect(x + 1, 40 - amp, barW - 2, amp * 2, 2)
        ctx.fill()
      }

      tRef.current += isActive ? 0.05 : 0.01
      rafRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [isActive, audioLevel])

  return (
    <div className="waveform-card">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        position: 'relative',
        zIndex: 1,
      }}>
        <span style={{
          fontSize: 10.5,
          color: 'var(--text3)',
          textTransform: 'uppercase' as const,
          letterSpacing: 1,
        }}>
          Forma de onda — entrada
        </span>
        <span className="font-mono" style={{
          fontSize: 11,
          color: 'var(--purple-light)',
        }}>
          {audioLevel === 0
            ? '-∞ dB'
            : `${Math.round((audioLevel / 100) * 48 - 48)} dB`}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: 80, display: 'block', position: 'relative', zIndex: 1 }}
      />
    </div>
  )
}
