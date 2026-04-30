-- ============================================
-- Audio Management Policies
-- Problem: Speakers and organizers cannot delete/replace audio
--   from the desktop app because RLS blocks storage DELETE,
--   lecture UPDATE, and processing_jobs/materials DELETE.
-- Solution: Add targeted policies for audio management operations.
-- ============================================

-- ============================================
-- 1. HELPER: Is user the speaker assigned to a lecture?
-- ============================================

CREATE OR REPLACE FUNCTION public.is_lecture_speaker(lec_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lectures l
    JOIN public.speakers s ON s.id = l.speaker_id
    WHERE l.id = lec_uuid AND s.user_id = auth.uid()
  );
$$;

-- ============================================
-- 2. STORAGE: audio-files — speakers can LIST and DELETE their own audio
-- ============================================

-- Speakers can list (SELECT) their own lecture audio files
CREATE POLICY "speakers_list_own_audio"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'audio-files' AND
    EXISTS (
      SELECT 1 FROM public.lectures l
      JOIN public.speakers s ON s.id = l.speaker_id
      WHERE s.user_id = auth.uid()
        AND (
          -- Match storage path: {event_id}/{lecture_id}/...
          l.event_id::text = (storage.foldername(name))[1]
          AND l.id::text = (storage.foldername(name))[2]
        )
    )
  );

-- Speakers can delete their own lecture audio files
CREATE POLICY "speakers_delete_own_audio"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'audio-files' AND
    EXISTS (
      SELECT 1 FROM public.lectures l
      JOIN public.speakers s ON s.id = l.speaker_id
      WHERE s.user_id = auth.uid()
        AND l.event_id::text = (storage.foldername(name))[1]
        AND l.id::text = (storage.foldername(name))[2]
    )
  );

-- Organizers can delete audio files for their events
CREATE POLICY "organizers_delete_audio"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'audio-files' AND
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.organizer_id = auth.uid()
        AND e.id::text = (storage.foldername(name))[1]
    )
  );

-- ============================================
-- 3. LECTURES: speakers can update their own lecture status/audio fields
-- ============================================

DROP POLICY IF EXISTS "speakers_update_own_lectures" ON public.lectures;
CREATE POLICY "speakers_update_own_lectures"
  ON public.lectures FOR UPDATE
  TO authenticated
  USING (public.is_lecture_speaker(id))
  WITH CHECK (public.is_lecture_speaker(id));

-- ============================================
-- 4. PROCESSING_JOBS: speakers and organizers can manage jobs
-- ============================================

-- Speakers can view and delete their own lecture's processing jobs
DROP POLICY IF EXISTS "speakers_manage_own_jobs" ON public.processing_jobs;
CREATE POLICY "speakers_manage_own_jobs"
  ON public.processing_jobs FOR ALL
  TO authenticated
  USING (public.is_lecture_speaker(lecture_id))
  WITH CHECK (public.is_lecture_speaker(lecture_id));

-- Organizers can manage jobs for their event lectures
DROP POLICY IF EXISTS "organizers_manage_jobs" ON public.processing_jobs;
CREATE POLICY "organizers_manage_jobs"
  ON public.processing_jobs FOR ALL
  TO authenticated
  USING (public.is_lecture_organizer(lecture_id))
  WITH CHECK (public.is_lecture_organizer(lecture_id));

-- ============================================
-- 5. LECTURE_MATERIALS: speakers and organizers can delete materials
-- ============================================

DROP POLICY IF EXISTS "speakers_delete_own_materials" ON public.lecture_materials;
CREATE POLICY "speakers_delete_own_materials"
  ON public.lecture_materials FOR DELETE
  TO authenticated
  USING (public.is_lecture_speaker(lecture_id));

DROP POLICY IF EXISTS "organizers_manage_materials" ON public.lecture_materials;
CREATE POLICY "organizers_manage_materials"
  ON public.lecture_materials FOR ALL
  TO authenticated
  USING (public.is_lecture_organizer(lecture_id))
  WITH CHECK (public.is_lecture_organizer(lecture_id));

-- ============================================
-- 6. GENERATION_CONFIGS: speakers and organizers can manage configs
-- ============================================

DROP POLICY IF EXISTS "speakers_manage_own_configs" ON public.generation_configs;
CREATE POLICY "speakers_manage_own_configs"
  ON public.generation_configs FOR ALL
  TO authenticated
  USING (public.is_lecture_speaker(lecture_id))
  WITH CHECK (public.is_lecture_speaker(lecture_id));

-- ============================================
-- 7. GRANTS: ensure DELETE permission is available
-- ============================================

GRANT DELETE ON public.processing_jobs TO authenticated;
GRANT DELETE ON public.lecture_materials TO authenticated;
GRANT DELETE ON public.generation_configs TO authenticated;
GRANT UPDATE ON public.lectures TO authenticated;
