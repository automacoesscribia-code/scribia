// ScribIA Constants

export const EVENT_STATUSES = ['draft', 'active', 'completed', 'archived'] as const
export const LECTURE_STATUSES = ['scheduled', 'recording', 'processing', 'completed', 'failed'] as const
export const USER_ROLES = ['organizer', 'participant'] as const
export const PROCESSING_JOB_TYPES = ['transcription', 'summary', 'ebook', 'playbook', 'card'] as const
export const PROCESSING_JOB_STATUSES = ['queued', 'processing', 'completed', 'failed'] as const

// Storage paths
export const AUDIO_BUCKET = 'audio-files'
export const MATERIALS_BUCKET = 'materials'

export function getAudioPath(eventId: string, lectureId: string, chunkIndex?: number): string {
  if (chunkIndex !== undefined) {
    return `${eventId}/${lectureId}/chunk_${chunkIndex}.webm`
  }
  return `${eventId}/${lectureId}/final.webm`
}

export function getMaterialPath(eventId: string, lectureId: string, type: string, ext: string = 'pdf'): string {
  return `${eventId}/${lectureId}/${type}.${ext}`
}

// Processing progress checkpoints
export const PROGRESS_CHECKPOINTS = {
  transcription: { start: 0, end: 25 },
  summary: { start: 25, end: 50 },
  ebook: { start: 50, end: 75 },
  playbook: { start: 75, end: 90 },
  card: { start: 90, end: 100 },
} as const
