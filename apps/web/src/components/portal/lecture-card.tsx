'use client'

import { Chip } from '@/components/ui/chip'
import { Play } from 'lucide-react'

interface LectureCardProps {
  title: string
  speaker: string
  status: string
  duration: string
  hasEbook: boolean
  gradientIndex: number
  onPlay?: () => void
}

const gradients = [
  'bg-gradient-to-br from-[#1a1230] to-[#2a1a4a]',
  'bg-gradient-to-br from-[#0a1f2a] to-[#0a2a1f]',
  'bg-gradient-to-br from-[#1a1a0a] to-[#2a1a0a]',
  'bg-gradient-to-br from-[#1a0a1a] to-[#0a1a2a]',
  'bg-gradient-to-br from-[#0a2020] to-[#0a1a2a]',
  'bg-gradient-to-br from-[#1a1a1a] to-[#2a1a10]',
]

const waveColors = [
  'bg-purple-light',
  'bg-scribia-green',
  'bg-scribia-yellow',
  'bg-purple-light',
  'bg-scribia-teal',
  'bg-[#FF8B71]',
]

const wavePresets = [
  [32, 20, 40, 24, 36, 16, 28],
  [18, 34, 22, 42, 14, 30, 20],
  [28, 16, 38, 20, 32, 12, 24],
  [22, 36, 14, 40, 26, 18, 34],
  [30, 18, 44, 22, 38, 12, 26],
  [16, 32, 24, 40, 20, 36, 14],
]

function getStatusConfig(status: string, hasEbook: boolean): { label: string; variant: 'green' | 'yellow' | 'purple' } {
  if (hasEbook) return { label: 'E-book Pronto', variant: 'purple' }
  if (status === 'completed') return { label: 'Transcrito', variant: 'green' }
  if (status === 'processing') return { label: 'Processando', variant: 'yellow' }
  return { label: 'Transcrito', variant: 'green' }
}

export function LectureCard({
  title,
  speaker,
  status,
  duration,
  hasEbook,
  gradientIndex,
  onPlay,
}: LectureCardProps) {
  const idx = gradientIndex % 6
  const { label, variant } = getStatusConfig(status, hasEbook)
  const isProcessing = status === 'processing'
  const heights = wavePresets[idx]
  const speeds = [0.6, 0.8, 0.5, 0.9, 0.7, 1.0, 0.6]

  return (
    <div className="bg-bg2 border border-border-subtle rounded-[14px] overflow-hidden transition-all hover:border-border-purple hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(107,78,255,0.12)] animate-fade-up cursor-pointer">
      {/* Gradient top with mini-waveform */}
      <div className={`h-[90px] flex items-center justify-center ${gradients[idx]}`}>
        <div className="flex items-center gap-[2px]">
          {heights.map((h, i) => (
            <span
              key={i}
              className={`w-[3px] rounded-sm opacity-60 ${waveColors[idx]}`}
              style={{
                animation: `mw ${speeds[i]}s ease-in-out infinite alternate`,
                height: '6px',
                // @ts-expect-error CSS custom property
                '--h': `${h}px`,
                '--d': `${speeds[i]}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="font-heading text-sm font-bold text-text mb-1 leading-tight">
          {title}
        </div>
        <div className="text-[12px] text-text3 mb-3">{speaker}</div>
        <div className="flex items-center justify-between">
          <Chip variant={variant}>{label}</Chip>
          <span className="text-[11px] text-text3">{duration}</span>
        </div>
      </div>

      {/* Footer actions */}
      <div className="px-4 py-3 border-t border-border-subtle flex gap-2">
        <button
          onClick={onPlay}
          className="flex-1 flex items-center justify-center gap-1.5 bg-purple text-white rounded-lg py-2 text-[12px] font-medium hover:bg-purple-light transition-all"
        >
          <Play className="w-3.5 h-3.5" />
          Ouvir
        </button>
        {isProcessing ? (
          <button
            disabled
            className="flex-1 flex items-center justify-center gap-1.5 bg-transparent border border-border-subtle rounded-lg py-2 text-[12px] text-text3 opacity-40 cursor-not-allowed"
          >
            Em breve
          </button>
        ) : (
          <button className="flex-1 flex items-center justify-center gap-1.5 bg-transparent border border-border-subtle text-text2 rounded-lg py-2 text-[12px] hover:border-border-purple hover:text-purple-light transition-all">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            E-book
          </button>
        )}
      </div>
    </div>
  )
}
