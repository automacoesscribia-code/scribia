// ScribIA Data Model Types

export type EventStatus = 'draft' | 'active' | 'completed' | 'archived'
export type LectureStatus = 'scheduled' | 'recording' | 'processing' | 'completed' | 'failed'
export type UserRole = 'super_admin' | 'organizer' | 'participant' | 'speaker'
export type ProcessingJobType = 'transcription' | 'summary' | 'ebook' | 'playbook' | 'card'
export type ProcessingJobStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface UserProfile {
  id: string
  email: string
  full_name: string
  roles: UserRole[]
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Event {
  id: string
  organizer_id: string
  name: string
  description: string | null
  start_date: string
  end_date: string
  location: string | null
  cover_image_url: string | null
  status: EventStatus
  created_at: string
  updated_at: string
}

export interface Speaker {
  id: string
  name: string
  email: string | null
  bio: string | null
  company: string | null
  role: string | null
  avatar_url: string | null
  user_id: string | null
  created_at: string
}

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'
export type InvitationRole = 'organizer' | 'participant' | 'speaker'

export interface Invitation {
  id: string
  email: string
  role: InvitationRole
  invited_by: string
  event_id: string | null
  speaker_id: string | null
  status: InvitationStatus
  token: string
  expires_at: string
  accepted_at: string | null
  created_at: string
  updated_at: string
}

export interface Lecture {
  id: string
  event_id: string
  speaker_id: string | null
  title: string
  description: string | null
  scheduled_at: string | null
  duration_seconds: number | null
  status: LectureStatus
  audio_path: string | null
  audio_duration_seconds: number | null
  transcript_text: string | null
  summary: string | null
  topics: string[] | null
  ebook_url: string | null
  playbook_url: string | null
  card_image_url: string | null
  processing_progress: number
  created_at: string
  updated_at: string
}

export interface EventParticipant {
  id: string
  event_id: string
  user_id: string
  attended: boolean
  registered_at: string
}

export interface LectureAccess {
  id: string
  lecture_id: string
  user_id: string
  accessed_at: string | null
  download_count: number
  created_at: string
}

export interface ProcessingJob {
  id: string
  lecture_id: string
  type: ProcessingJobType
  status: ProcessingJobStatus
  attempt_count: number
  error_message: string | null
  created_at: string
  updated_at: string
}
