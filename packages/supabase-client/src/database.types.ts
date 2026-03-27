// AUTO-GENERATED placeholder — regenerate with: npm run db:types
// This file will be overwritten by `supabase gen types typescript` when Supabase local is running

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          roles: Array<'super_admin' | 'organizer' | 'participant' | 'speaker'>
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string
          roles?: Array<'super_admin' | 'organizer' | 'participant' | 'speaker'>
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          roles?: Array<'super_admin' | 'organizer' | 'participant' | 'speaker'>
          avatar_url?: string | null
          updated_at?: string
        }
      }
      events: {
        Row: {
          id: string
          organizer_id: string
          name: string
          description: string | null
          start_date: string
          end_date: string
          location: string | null
          cover_image_url: string | null
          status: 'draft' | 'active' | 'completed' | 'archived'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organizer_id: string
          name: string
          description?: string | null
          start_date: string
          end_date: string
          location?: string | null
          cover_image_url?: string | null
          status?: 'draft' | 'active' | 'completed' | 'archived'
          created_at?: string
          updated_at?: string
        }
        Update: {
          organizer_id?: string
          name?: string
          description?: string | null
          start_date?: string
          end_date?: string
          location?: string | null
          cover_image_url?: string | null
          status?: 'draft' | 'active' | 'completed' | 'archived'
          updated_at?: string
        }
      }
      speakers: {
        Row: {
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
        Insert: {
          id?: string
          name: string
          email?: string | null
          bio?: string | null
          company?: string | null
          role?: string | null
          avatar_url?: string | null
          user_id?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          email?: string | null
          bio?: string | null
          company?: string | null
          role?: string | null
          avatar_url?: string | null
          user_id?: string | null
        }
      }
      lectures: {
        Row: {
          id: string
          event_id: string
          speaker_id: string | null
          title: string
          description: string | null
          scheduled_at: string | null
          duration_seconds: number | null
          status: 'scheduled' | 'recording' | 'processing' | 'completed' | 'failed'
          audio_path: string | null
          audio_duration_seconds: number | null
          transcript_text: string | null
          summary: string | null
          topics: string[] | null
          ebook_url: string | null
          ebook_content: string | null
          playbook_url: string | null
          playbook_content: string | null
          card_image_url: string | null
          processing_progress: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          speaker_id?: string | null
          title: string
          description?: string | null
          scheduled_at?: string | null
          duration_seconds?: number | null
          status?: 'scheduled' | 'recording' | 'processing' | 'completed' | 'failed'
          audio_path?: string | null
          audio_duration_seconds?: number | null
          transcript_text?: string | null
          summary?: string | null
          topics?: string[] | null
          ebook_url?: string | null
          ebook_content?: string | null
          playbook_url?: string | null
          playbook_content?: string | null
          card_image_url?: string | null
          processing_progress?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          event_id?: string
          speaker_id?: string | null
          title?: string
          description?: string | null
          scheduled_at?: string | null
          duration_seconds?: number | null
          status?: 'scheduled' | 'recording' | 'processing' | 'completed' | 'failed'
          audio_path?: string | null
          audio_duration_seconds?: number | null
          transcript_text?: string | null
          summary?: string | null
          topics?: string[] | null
          ebook_url?: string | null
          ebook_content?: string | null
          playbook_url?: string | null
          playbook_content?: string | null
          card_image_url?: string | null
          processing_progress?: number
          updated_at?: string
        }
      }
      event_participants: {
        Row: {
          id: string
          event_id: string
          user_id: string
          attended: boolean
          registered_at: string
        }
        Insert: {
          id?: string
          event_id: string
          user_id: string
          attended?: boolean
          registered_at?: string
        }
        Update: {
          event_id?: string
          user_id?: string
          attended?: boolean
        }
      }
      lecture_access: {
        Row: {
          id: string
          lecture_id: string
          user_id: string
          accessed_at: string | null
          download_count: number
          created_at: string
        }
        Insert: {
          id?: string
          lecture_id: string
          user_id: string
          accessed_at?: string | null
          download_count?: number
          created_at?: string
        }
        Update: {
          lecture_id?: string
          user_id?: string
          accessed_at?: string | null
          download_count?: number
        }
      }
      processing_jobs: {
        Row: {
          id: string
          lecture_id: string
          type: 'transcription' | 'summary' | 'ebook' | 'playbook' | 'card'
          status: 'queued' | 'processing' | 'completed' | 'failed'
          attempt_count: number
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lecture_id: string
          type: 'transcription' | 'summary' | 'ebook' | 'playbook' | 'card'
          status?: 'queued' | 'processing' | 'completed' | 'failed'
          attempt_count?: number
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          lecture_id?: string
          type?: 'transcription' | 'summary' | 'ebook' | 'playbook' | 'card'
          status?: 'queued' | 'processing' | 'completed' | 'failed'
          attempt_count?: number
          error_message?: string | null
          updated_at?: string
        }
      }
      invitations: {
        Row: {
          id: string
          email: string
          role: 'organizer' | 'participant' | 'speaker'
          invited_by: string
          event_id: string | null
          speaker_id: string | null
          status: 'pending' | 'accepted' | 'expired' | 'revoked'
          token: string
          expires_at: string
          accepted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          role: 'organizer' | 'participant' | 'speaker'
          invited_by: string
          event_id?: string | null
          speaker_id?: string | null
          status?: 'pending' | 'accepted' | 'expired' | 'revoked'
          token?: string
          expires_at?: string
          accepted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          role?: 'organizer' | 'participant' | 'speaker'
          invited_by?: string
          event_id?: string | null
          speaker_id?: string | null
          status?: 'pending' | 'accepted' | 'expired' | 'revoked'
          accepted_at?: string | null
          updated_at?: string
        }
      }
      ai_settings: {
        Row: {
          id: string
          provider: 'gemini' | 'openai' | 'anthropic'
          api_key: string
          model: string
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          provider?: 'gemini' | 'openai' | 'anthropic'
          api_key?: string
          model?: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          provider?: 'gemini' | 'openai' | 'anthropic'
          api_key?: string
          model?: string
          updated_by?: string | null
          updated_at?: string
        }
      }
      system_prompts: {
        Row: {
          id: string
          key: string
          name: string
          description: string | null
          prompt_text: string
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          name: string
          description?: string | null
          prompt_text: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          key?: string
          name?: string
          description?: string | null
          prompt_text?: string
          updated_by?: string | null
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_super_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      get_user_role: {
        Args: Record<string, never>
        Returns: string
      }
    }
    Enums: {
      user_role: 'super_admin' | 'organizer' | 'participant'
    }
  }
}
