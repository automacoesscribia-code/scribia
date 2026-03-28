import Link from 'next/link'
import { ProgressBar } from '@/components/ui/progress-bar'

interface ProcessingOverviewProps {
  eventId: string
  totalLectures: number
  transcribed: number
  ebooksGenerated: number
  cardsGenerated: number
  playbooksGenerated: number
}

export function ProcessingOverview({
  eventId,
  totalLectures,
  transcribed,
  ebooksGenerated,
  cardsGenerated,
  playbooksGenerated,
}: ProcessingOverviewProps) {
  return (
    <div className="bg-bg2 border border-border-subtle rounded-[14px] overflow-hidden animate-fade-up">
      <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
        <h3 className="font-heading text-sm font-bold text-text">
          Processamento de áudio
        </h3>
        <Link
          href={`/dashboard/events/${eventId}`}
          className="text-xs text-purple-light hover:text-purple transition-colors"
        >
          Detalhes
        </Link>
      </div>
      <div className="px-5 py-4">
        <ProgressBar
          label="Transcrição"
          value={transcribed}
          max={totalLectures}
          color="green"
        />
        <ProgressBar
          label="E-books gerados"
          value={ebooksGenerated}
          max={totalLectures}
          color="purple"
        />
        <ProgressBar
          label="Cards de divulgação"
          value={cardsGenerated}
          max={totalLectures}
          color="yellow"
        />
        <ProgressBar
          label="Playbooks gerados"
          value={playbooksGenerated}
          max={totalLectures}
          color="teal"
        />
      </div>
    </div>
  )
}
