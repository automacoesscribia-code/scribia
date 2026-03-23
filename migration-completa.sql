-- ============================================
-- ScribIA - Migration Completa
-- Cole este SQL no Supabase Dashboard > SQL Editor > New Query > Run
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- 1. user_profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('organizer', 'participant')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. events
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT events_dates_check CHECK (end_date >= start_date)
);

-- 3. speakers
CREATE TABLE IF NOT EXISTS public.speakers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  bio TEXT,
  company TEXT,
  role TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. lectures
CREATE TABLE IF NOT EXISTS public.lectures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  speaker_id UUID REFERENCES public.speakers(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'recording', 'processing', 'completed', 'failed')),
  audio_path TEXT,
  audio_duration_seconds INTEGER,
  transcript_text TEXT,
  summary TEXT,
  topics TEXT[],
  ebook_url TEXT,
  playbook_url TEXT,
  card_image_url TEXT,
  processing_progress INTEGER NOT NULL DEFAULT 0 CHECK (processing_progress >= 0 AND processing_progress <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. event_participants
CREATE TABLE IF NOT EXISTS public.event_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  attended BOOLEAN NOT NULL DEFAULT false,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- 6. lecture_access
CREATE TABLE IF NOT EXISTS public.lecture_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lecture_id UUID NOT NULL REFERENCES public.lectures(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  accessed_at TIMESTAMPTZ,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lecture_id, user_id)
);

-- 7. processing_jobs
CREATE TABLE IF NOT EXISTS public.processing_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lecture_id UUID NOT NULL REFERENCES public.lectures(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('transcription', 'summary', 'ebook', 'playbook', 'card')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_events_organizer ON public.events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_lectures_event ON public.lectures(event_id);
CREATE INDEX IF NOT EXISTS idx_lectures_speaker ON public.lectures(speaker_id);
CREATE INDEX IF NOT EXISTS idx_lectures_status ON public.lectures(status);
CREATE INDEX IF NOT EXISTS idx_event_participants_user ON public.event_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_lecture ON public.processing_jobs(lecture_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON public.processing_jobs(status);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecture_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;

-- user_profiles policies
DO $$ BEGIN
CREATE POLICY "users_read_own_profile" ON public.user_profiles FOR SELECT USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "users_update_own_profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- events policies
DO $$ BEGIN
CREATE POLICY "organizers_manage_own_events" ON public.events FOR ALL USING (auth.uid() = organizer_id) WITH CHECK (auth.uid() = organizer_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "participants_view_joined_active_events" ON public.events FOR SELECT USING (
  status = 'active' AND EXISTS (
    SELECT 1 FROM public.event_participants ep WHERE ep.event_id = id AND ep.user_id = auth.uid()
  )
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- speakers policies
DO $$ BEGIN
CREATE POLICY "authenticated_read_speakers" ON public.speakers FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "organizers_manage_speakers" ON public.speakers FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.events e JOIN public.lectures l ON l.event_id = e.id
    WHERE l.speaker_id = speakers.id AND e.organizer_id = auth.uid()
  )
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- lectures policies
DO $$ BEGIN
CREATE POLICY "organizers_manage_lectures_by_event" ON public.lectures FOR ALL USING (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "participants_view_accessible_lectures" ON public.lectures FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.lecture_access la WHERE la.lecture_id = id AND la.user_id = auth.uid())
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- event_participants policies
DO $$ BEGIN
CREATE POLICY "users_view_own_participation" ON public.event_participants FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "organizers_manage_participants_by_event" ON public.event_participants FOR ALL USING (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- lecture_access policies
DO $$ BEGIN
CREATE POLICY "users_view_own_access" ON public.lecture_access FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "organizers_manage_access_by_event" ON public.lecture_access FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.lectures l JOIN public.events e ON e.id = l.event_id
    WHERE l.id = lecture_id AND e.organizer_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lectures l JOIN public.events e ON e.id = l.event_id
    WHERE l.id = lecture_id AND e.organizer_id = auth.uid()
  )
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- processing_jobs policies
DO $$ BEGIN
CREATE POLICY "organizers_view_jobs_by_event" ON public.processing_jobs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.lectures l JOIN public.events e ON e.id = l.event_id
    WHERE l.id = lecture_id AND e.organizer_id = auth.uid()
  )
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "service_role_manage_jobs" ON public.processing_jobs FOR ALL USING (auth.jwt()->>'role' = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_user_profiles ON public.user_profiles;
CREATE TRIGGER set_updated_at_user_profiles BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_events ON public.events;
CREATE TRIGGER set_updated_at_events BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_lectures ON public.lectures;
CREATE TRIGGER set_updated_at_lectures BEFORE UPDATE ON public.lectures FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_processing_jobs ON public.processing_jobs;
CREATE TRIGGER set_updated_at_processing_jobs BEFORE UPDATE ON public.processing_jobs FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create user_profiles on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'participant'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- STORAGE BUCKETS
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('audio-files', 'audio-files', false, 524288000, ARRAY['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a']),
  ('materials', 'materials', false, 52428800, ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies: audio-files
DO $$ BEGIN
CREATE POLICY "authenticated_upload_audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audio-files' AND auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "organizers_read_audio" ON storage.objects FOR SELECT USING (
  bucket_id = 'audio-files' AND EXISTS (
    SELECT 1 FROM public.events e WHERE e.organizer_id = auth.uid() AND e.id::text = (storage.foldername(name))[1]
  )
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Storage policies: materials
DO $$ BEGIN
CREATE POLICY "service_role_insert_materials" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'materials' AND auth.jwt()->>'role' = 'service_role'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "users_download_accessible_materials" ON storage.objects FOR SELECT USING (
  bucket_id = 'materials' AND EXISTS (
    SELECT 1 FROM public.lecture_access la WHERE la.user_id = auth.uid() AND la.lecture_id::text = (storage.foldername(name))[2]
  )
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "organizers_read_materials" ON storage.objects FOR SELECT USING (
  bucket_id = 'materials' AND EXISTS (
    SELECT 1 FROM public.events e WHERE e.organizer_id = auth.uid() AND e.id::text = (storage.foldername(name))[1]
  )
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- AUTO LECTURE ACCESS TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION public.auto_grant_lecture_access()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.lecture_access (lecture_id, user_id)
  SELECT NEW.id, ep.user_id
  FROM public.event_participants ep
  WHERE ep.event_id = NEW.event_id
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_lecture_created ON public.lectures;
CREATE TRIGGER on_lecture_created AFTER INSERT ON public.lectures FOR EACH ROW EXECUTE FUNCTION public.auto_grant_lecture_access();

-- ============================================
-- DONE! Todas as tabelas, policies, triggers e buckets criados.
-- ============================================
