-- ============================================
-- FIX: Infinite recursion in RLS policies
-- Applied via Supabase MCP on 2026-03-19
-- Problem: Cross-table policy checks create circular dependencies
--   events → event_participants → events (infinite loop)
-- Solution: SECURITY DEFINER functions bypass RLS in sub-queries
-- ============================================

-- 1. Helper: Is user the organizer of an event?
CREATE OR REPLACE FUNCTION public.is_event_organizer(event_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events
    WHERE id = event_uuid AND organizer_id = auth.uid()
  );
$$;

-- 2. Helper: Is user a participant of an event?
CREATE OR REPLACE FUNCTION public.is_event_participant(event_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_participants
    WHERE event_id = event_uuid AND user_id = auth.uid()
  );
$$;

-- 3. Helper: Is user the organizer of a lecture's event?
CREATE OR REPLACE FUNCTION public.is_lecture_organizer(lec_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lectures l
    JOIN public.events e ON e.id = l.event_id
    WHERE l.id = lec_uuid AND e.organizer_id = auth.uid()
  );
$$;

-- Drop all problematic policies
DROP POLICY IF EXISTS "participants_view_joined_active_events" ON public.events;
DROP POLICY IF EXISTS "organizers_manage_participants_by_event" ON public.event_participants;
DROP POLICY IF EXISTS "organizers_manage_lectures_by_event" ON public.lectures;
DROP POLICY IF EXISTS "organizers_manage_access_by_event" ON public.lecture_access;
DROP POLICY IF EXISTS "organizers_view_jobs_by_event" ON public.processing_jobs;
DROP POLICY IF EXISTS "organizers_manage_speakers" ON public.speakers;

-- Recreate using helper functions (no more recursion)
CREATE POLICY "participants_view_joined_active_events"
  ON public.events FOR SELECT
  USING (status = 'active' AND public.is_event_participant(id));

CREATE POLICY "organizers_manage_participants_by_event"
  ON public.event_participants FOR ALL
  USING (public.is_event_organizer(event_id))
  WITH CHECK (public.is_event_organizer(event_id));

CREATE POLICY "organizers_manage_lectures_by_event"
  ON public.lectures FOR ALL
  USING (public.is_event_organizer(event_id))
  WITH CHECK (public.is_event_organizer(event_id));

CREATE POLICY "organizers_manage_access_by_event"
  ON public.lecture_access FOR ALL
  USING (public.is_lecture_organizer(lecture_id))
  WITH CHECK (public.is_lecture_organizer(lecture_id));

CREATE POLICY "organizers_view_jobs_by_event"
  ON public.processing_jobs FOR SELECT
  USING (public.is_lecture_organizer(lecture_id));

CREATE POLICY "organizers_manage_speakers"
  ON public.speakers FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
