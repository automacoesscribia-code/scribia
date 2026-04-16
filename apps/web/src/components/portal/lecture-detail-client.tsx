'use client'

import { useState } from 'react'
import { AudioPlayer } from './audio-player'
import { EbookPreview } from './ebook-preview'
import { Chip } from '@/components/ui/chip'
import Link from 'next/link'
import { ChevronLeft, BookOpen, FileText, Mic } from 'lucide-react'

interface LectureDetailClientProps {
  lectureId: string
  title: string
  speaker: string
  eventName: string
  duration: number | null
  status: string
  summary: string | null
  ebookContent: string | null
  playbookContent: string | null
  transcript: string | null
  audioUrl: string | null
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}min`
  return `${m}min`
}

const TABS = [
  { id: 'player', label: 'Áudio', icon: Mic },
  { id: 'ebook', label: 'E-book', icon: BookOpen },
  { id: 'playbook', label: 'Playbook', icon: FileText },
] as const

export function LectureDetailClient({
  lectureId,
  title,
  speaker,
  eventName,
  duration,
  status,
  summary,
  ebookContent,
  playbookContent,
  transcript,
  audioUrl,
}: LectureDetailClientProps) {
  const [activeTab, setActiveTab] = useState<string>('player')

  const chipVariant = ebookContent ? 'purple' : status === 'completed' ? 'green' : status === 'processing' ? 'yellow' : 'default'
  const chipLabel = ebookContent ? 'E-book Pronto' : status === 'completed' ? 'Transcrito' : status === 'processing' ? 'Processando' : 'Agendada'

  return (
    <div className="animate-fade-up">
      {/* Back link */}
      <Link
        href="/portal"
        className="inline-flex items-center gap-1 text-[13px] text-text3 hover:text-purple-light transition-colors mb-6"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Voltar às palestras
      </Link>

      {/* Header */}
      <div className="mb-5 sm:mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Chip variant={chipVariant}>{chipLabel}</Chip>
          <span className="text-[11px] text-text3">{formatDuration(duration)}</span>
        </div>
        <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-text leading-tight break-words">{title}</h1>
        <p className="text-[13px] text-text3 mt-1 break-words">
          {speaker} · {eventName}
        </p>
      </div>

      {/* Summary */}
      {summary && (
        <div className="bg-bg2 border border-border-subtle rounded-xl p-4 sm:p-5 mb-5 sm:mb-6">
          <h3 className="font-heading text-sm font-bold text-text mb-2">Resumo</h3>
          <p className="text-[13px] text-text2 leading-6">{summary}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border-subtle mb-5 sm:mb-6 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-purple text-purple-light'
                : 'border-transparent text-text3 hover:text-text2'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'player' && (
        <AudioPlayer
          title={title}
          speaker={`${speaker} · ${formatDuration(duration)}`}
          duration={formatDuration(duration)}
          audioUrl={audioUrl ?? undefined}
        />
      )}

      {activeTab === 'ebook' && (
        <div>
          {ebookContent ? (
            <div className="bg-bg2 border border-border-subtle rounded-xl p-4 sm:p-6">
              <div className="prose prose-invert prose-sm max-w-none text-text2 leading-7 text-[13.5px]">
                {ebookContent.split('\n').map((line, i) => {
                  if (line.startsWith('# ')) return <h2 key={i} className="font-heading text-lg font-bold text-text mt-6 mb-3">{line.slice(2)}</h2>
                  if (line.startsWith('## ')) return <h3 key={i} className="font-heading text-base font-bold text-text mt-4 mb-2">{line.slice(3)}</h3>
                  if (line.startsWith('- ')) return <li key={i} className="ml-4 mb-1">{line.slice(2)}</li>
                  if (line.trim() === '') return <br key={i} />
                  return <p key={i} className="mb-2">{line}</p>
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-text3 text-[13px]">E-book em processamento...</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'playbook' && (
        <div>
          {playbookContent ? (
            <div className="bg-bg2 border border-border-subtle rounded-xl p-4 sm:p-6">
              <div className="text-text2 leading-7 text-[13.5px]">
                {playbookContent.split('\n').map((line, i) => {
                  if (line.startsWith('# ')) return <h2 key={i} className="font-heading text-lg font-bold text-text mt-6 mb-3">{line.slice(2)}</h2>
                  if (line.startsWith('## ')) return <h3 key={i} className="font-heading text-base font-bold text-text mt-4 mb-2">{line.slice(3)}</h3>
                  if (line.startsWith('- [ ] ')) return <div key={i} className="flex items-center gap-2 ml-4 mb-1"><input type="checkbox" className="accent-purple" />{line.slice(6)}</div>
                  if (line.startsWith('- [x] ')) return <div key={i} className="flex items-center gap-2 ml-4 mb-1"><input type="checkbox" checked readOnly className="accent-purple" /><span className="line-through text-text3">{line.slice(6)}</span></div>
                  if (line.startsWith('- ')) return <li key={i} className="ml-4 mb-1">{line.slice(2)}</li>
                  if (line.trim() === '') return <br key={i} />
                  return <p key={i} className="mb-2">{line}</p>
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-text3 text-[13px]">Playbook em processamento...</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
