-- ============================================
-- FIX: Storage UPDATE policies for audio-files bucket
-- Problem: Upload with x-upsert:true does UPDATE on existing objects,
--   but no UPDATE policy exists → "new row violates row-level security policy"
-- Also: Organizers need UPDATE policy on storage for re-uploads
-- ============================================

-- 1. UPDATE policy for authenticated users (matches existing INSERT policy)
CREATE POLICY "authenticated_update_audio"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'audio-files' AND auth.uid() IS NOT NULL)
  WITH CHECK (bucket_id = 'audio-files' AND auth.uid() IS NOT NULL);

-- 2. Organizers can LIST audio for their events (already had SELECT but let's ensure)
DROP POLICY IF EXISTS "organizers_read_audio" ON storage.objects;
CREATE POLICY "organizers_read_audio"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'audio-files' AND
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.organizer_id = auth.uid()
        AND e.id::text = (storage.foldername(name))[1]
    )
  );

-- 3. Ensure INSERT grant covers all authenticated users on lectures
-- (needed for the desktop app to update lecture status after upload)
GRANT INSERT ON public.processing_jobs TO authenticated;
