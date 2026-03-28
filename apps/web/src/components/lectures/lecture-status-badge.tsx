import type { LectureStatus } from '@scribia/shared'
import { Chip } from '@/components/ui/chip'

const config: Record<LectureStatus, { label: string; variant: 'green' | 'yellow' | 'purple' | 'red' | 'default' }> = {
  scheduled: { label: 'Agendada', variant: 'default' },
  recording: { label: 'Gravando', variant: 'red' },
  processing: { label: 'Processando', variant: 'yellow' },
  completed: { label: 'Concluída', variant: 'green' },
  failed: { label: 'Falhou', variant: 'red' },
}

export function LectureStatusBadge({ status }: { status: LectureStatus }) {
  const { label, variant } = config[status] ?? config.scheduled
  return <Chip variant={variant}>{label}</Chip>
}
