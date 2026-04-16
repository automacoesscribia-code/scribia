'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Ban, SkipBack, SkipForward, Play, Pause, Volume2 } from 'lucide-react'

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2]

interface AudioPlayerProps {
  title: string
  speaker: string
  duration: string
  audioUrl?: string
}

function generateBarHeights(count: number): number[] {
  const bars: number[] = []
  for (let i = 0; i < count; i++) {
    const h = 8 + Math.abs(Math.sin(i * 0.3) * 18 + Math.sin(i * 0.7) * 12 + Math.sin(i * 1.3) * 8)
    bars.push(Math.round(h * 10) / 10)
  }
  return bars
}

function formatTime(seconds: number): string {
  if (isNaN(seconds)) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

const BAR_COUNT = 120
const barHeights = generateBarHeights(BAR_COUNT)

export function AudioPlayer({ title, speaker, duration, audioUrl }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [volume, setVolume] = useState(0.8)
  const [showSpeed, setShowSpeed] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  const progress = totalDuration > 0 ? currentTime / totalDuration : 0

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onLoadedMetadata = () => setTotalDuration(audio.duration)
    const onEnded = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current
    if (!audio || !totalDuration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    audio.currentTime = pct * totalDuration
  }

  function skip(delta: number) {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(totalDuration, audio.currentTime + delta))
  }

  function changeSpeed(s: number) {
    setSpeed(s)
    setShowSpeed(false)
    if (audioRef.current) audioRef.current.playbackRate = s
  }

  function changeVolume(v: number) {
    setVolume(v)
    if (audioRef.current) audioRef.current.volume = v
  }

  return (
    <div className="bg-bg2 border border-border-subtle rounded-2xl p-4 sm:p-6 animate-fade-up">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          controlsList="nodownload"
          onContextMenu={(e) => e.preventDefault()}
        />
      )}

      {/* Top info */}
      <div className="flex items-start justify-between gap-3 mb-4 sm:mb-5">
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] text-purple-light uppercase tracking-[1px] mb-1.5">
            ● Em reprodução
          </div>
          <div className="font-heading text-base sm:text-lg font-extrabold text-text break-words">
            {title}
          </div>
          <div className="text-[12px] sm:text-[13px] text-text3 mt-0.5 break-words">
            {speaker} · {duration}
          </div>
        </div>
        <div className="bg-scribia-red/8 border border-scribia-red/20 rounded-lg px-2.5 py-1.5 text-[10px] sm:text-[11px] text-[#FF7A90] flex items-center gap-1.5 shrink-0">
          <Ban className="w-3 h-3 shrink-0" />
          <span className="hidden sm:inline">Download não disponível</span>
          <span className="sm:hidden">Sem download</span>
        </div>
      </div>

      {/* Waveform (hidden on very small screens) */}
      <div className="hidden sm:flex items-center gap-[2px] h-12 mb-4 cursor-pointer" onClick={seek}>
        {barHeights.map((h, i) => (
          <div
            key={i}
            className={`w-[3px] rounded-sm shrink-0 transition-colors duration-100 ${
              i / BAR_COUNT < progress ? 'bg-purple' : 'bg-bg4'
            }`}
            style={{ height: `${h}px` }}
          />
        ))}
      </div>

      {/* Progress row */}
      <div className="flex items-center gap-3 mb-3 sm:mb-0">
        <span className="text-[11px] sm:text-xs text-text3 tabular-nums min-w-[36px]">
          {formatTime(currentTime)}
        </span>
        <div
          className="flex-1 h-1 bg-bg4 rounded-sm cursor-pointer relative"
          onClick={seek}
        >
          <div
            className="h-full bg-purple rounded-sm relative"
            style={{ width: `${progress * 100}%` }}
          >
            <div className="absolute -right-1.5 -top-1 w-3 h-3 rounded-full bg-purple border-2 border-bg2" />
          </div>
        </div>
        <span className="text-[11px] sm:text-xs text-text3 tabular-nums min-w-[36px] text-right">
          {formatTime(totalDuration) || duration}
        </span>
      </div>

      {/* Controls row - responsive */}
      <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-4 mt-3 sm:mt-4">
        {/* Playback buttons */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            onClick={() => skip(-10)}
            aria-label="Voltar 10s"
            className="w-9 h-9 rounded-full flex items-center justify-center text-text2 hover:text-text hover:bg-bg3 transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
            className="w-11 h-11 rounded-full bg-purple flex items-center justify-center text-white glow-purple hover:bg-purple-light transition-all shrink-0"
          >
            {isPlaying ? (
              <Pause className="w-[18px] h-[18px]" />
            ) : (
              <Play className="w-[18px] h-[18px] ml-0.5" />
            )}
          </button>
          <button
            onClick={() => skip(10)}
            aria-label="Avançar 10s"
            className="w-9 h-9 rounded-full flex items-center justify-center text-text2 hover:text-text hover:bg-bg3 transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Secondary controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Speed control */}
          <div className="relative">
            <button
              onClick={() => setShowSpeed(!showSpeed)}
              className="px-2 py-1 rounded-md bg-bg3 border border-border-subtle text-[11px] font-mono text-text2 hover:border-border-purple hover:text-purple-light transition-all"
            >
              {speed}x
            </button>
            {showSpeed && (
              <div className="absolute bottom-full mb-1 right-0 bg-bg2 border border-border-subtle rounded-lg py-1 shadow-lg z-10">
                {SPEED_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => changeSpeed(s)}
                    className={`block w-full px-3 py-1 text-[11px] text-left transition-colors ${
                      s === speed ? 'text-purple-light bg-purple-dim' : 'text-text2 hover:bg-bg3'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Volume (hidden on mobile, compact on tablet+) */}
          <div className="hidden sm:flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-text3" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label="Volume"
              className="w-16 h-1 accent-purple appearance-none bg-bg4 rounded-sm cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
