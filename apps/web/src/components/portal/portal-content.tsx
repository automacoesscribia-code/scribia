'use client'

import { useState, useRef } from 'react'
import { AudioPlayer } from './audio-player'
import { EbookPreview } from './ebook-preview'
import { LectureCard } from './lecture-card'

interface Lecture {
  id: string
  title: string
  status: string
  duration_seconds: number | null
  ebook_content: string | null
  speaker_name: string
  event_name: string
}

interface PortalContentProps {
  lectures: Lecture[]
  userName: string
  stats: {
    lectureCount: number
    ebookCount: number
    participantCount: number
  }
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}min`
  return `${m}min`
}

export function PortalContent({ lectures, userName, stats }: PortalContentProps) {
  const [activeLecture, setActiveLecture] = useState<Lecture | null>(
    lectures.find((l) => l.status === 'completed' && l.ebook_content) ?? lectures[0] ?? null,
  )
  const playerRef = useRef<HTMLDivElement>(null)

  function handlePlay(lecture: Lecture) {
    setActiveLecture(lecture)
    playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 md:px-10 py-6 md:py-9">
      {/* Hero */}
      <div className="mb-7 md:mb-9">
        <div className="text-[13px] text-text3 mb-1.5">Bem-vindo de volta,</div>
        <h1 className="font-heading text-[22px] sm:text-[26px] md:text-[28px] font-extrabold text-text leading-tight">
          Minhas Palestras
        </h1>
        <p className="text-[13px] sm:text-[14px] text-text3 mt-1.5">
          Acesse os conteúdos das palestras que você assistiu
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-5">
          <div className="flex items-center gap-2 text-[13px] text-text2">
            <span className="text-purple-light font-semibold">{stats.lectureCount}</span>
            palestras assistidas
          </div>
          <div className="flex items-center gap-2 text-[13px] text-text2">
            <span className="text-purple-light font-semibold">{stats.ebookCount}</span>
            e-books disponíveis
          </div>
          <div className="flex items-center gap-2 text-[13px] text-text2">
            <span className="text-purple-light font-semibold">{stats.participantCount}</span>
            participantes no evento
          </div>
        </div>
      </div>

      {/* Player Section */}
      {activeLecture && (
        <div ref={playerRef}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-base font-bold text-text">
              Ouvindo agora
            </h2>
          </div>
          <AudioPlayer
            key={activeLecture.id}
            title={activeLecture.title}
            speaker={`${activeLecture.speaker_name} · ${formatDuration(activeLecture.duration_seconds)}`}
            duration={formatDuration(activeLecture.duration_seconds)}
            audioUrl={`/api/audio/${activeLecture.id}`}
          />
          <EbookPreview content={activeLecture.ebook_content} />
          <div className="mb-8 md:mb-10" />
        </div>
      )}

      {/* Lectures Grid */}
      <div className="flex items-center justify-between mb-4 md:mb-4.5">
        <h2 className="font-heading text-base font-bold text-text">
          Todas as minhas palestras
        </h2>
        <span className="text-[12.5px] text-purple-light cursor-pointer hover:text-purple transition-colors">
          Filtrar
        </span>
      </div>

      {lectures.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-4.5 stagger-children">
          {lectures.map((lecture, i) => (
            <LectureCard
              key={lecture.id}
              title={lecture.title}
              speaker={lecture.speaker_name}
              status={lecture.status}
              duration={formatDuration(lecture.duration_seconds)}
              hasEbook={!!lecture.ebook_content}
              gradientIndex={i}
              onPlay={() => handlePlay(lecture)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-text3 text-[13px]">
            Nenhuma palestra disponível ainda.
          </p>
        </div>
      )}
    </div>
  )
}
