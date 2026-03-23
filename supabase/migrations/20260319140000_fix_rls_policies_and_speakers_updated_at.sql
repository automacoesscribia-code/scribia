-- ScribIA: Fix RLS policy bugs + speakers updated_at
-- Audit by @data-engineer (Dara)

-- ============================================
-- FIX 1 (CRITICAL): events policy self-join bug
-- ep.event_id = ep.id → ep.event_id = events.id
-- ============================================
DROP POLICY IF EXISTS "participants_view_joined_active_events" ON public.events;

CREATE POLICY "participants_view_joined_active_events"
  ON public.events FOR SELECT
  USING (
    status = 'active' AND
    EXISTS (
      SELECT 1 FROM public.event_participants ep
      WHERE ep.event_id = events.id AND ep.user_id = auth.uid()
    )
  );

-- ============================================
-- FIX 2 (CRITICAL): lectures policy self-join bug
-- la.lecture_id = la.id → la.lecture_id = lectures.id
-- ============================================
DROP POLICY IF EXISTS "participants_view_accessible_lectures" ON public.lectures;

CREATE POLICY "participants_view_accessible_lectures"
  ON public.lectures FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lecture_access la
      WHERE la.lecture_id = lectures.id AND la.user_id = auth.uid()
    )
  );

-- ============================================
-- FIX 3 (HIGH): service_role_manage_jobs missing WITH CHECK
-- ============================================
DROP POLICY IF EXISTS "service_role_manage_jobs" ON public.processing_jobs;

CREATE POLICY "service_role_manage_jobs"
  ON public.processing_jobs FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- FIX 4 (MEDIUM): speakers missing updated_at column + trigger
-- ============================================
ALTER TABLE public.speakers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TRIGGER set_updated_at_speakers
  BEFORE UPDATE ON public.speakers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
