-- ScribIA Storage Buckets
-- Story 1.4: Storage Setup & Audio Bucket

-- Create buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('audio-files', 'audio-files', false, 524288000, ARRAY['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a']),
  ('materials', 'materials', false, 52428800, ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg']);

-- ============================================
-- Storage Policies: audio-files
-- ============================================

-- Authenticated users can upload audio
CREATE POLICY "authenticated_upload_audio"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'audio-files' AND auth.uid() IS NOT NULL);

-- Audio accessed only via signed URLs (no direct SELECT policy for regular users)
-- Organizers can view their event audio
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

-- ============================================
-- Storage Policies: materials
-- ============================================

-- Only service_role can insert materials (Edge Functions generate them)
CREATE POLICY "service_role_insert_materials"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'materials' AND
    auth.jwt()->>'role' = 'service_role'
  );

-- Users with lecture_access can download materials
CREATE POLICY "users_download_accessible_materials"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'materials' AND
    EXISTS (
      SELECT 1 FROM public.lecture_access la
      WHERE la.user_id = auth.uid()
        AND la.lecture_id::text = (storage.foldername(name))[2]
    )
  );

-- Organizers can access all materials for their events
CREATE POLICY "organizers_read_materials"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'materials' AND
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.organizer_id = auth.uid()
        AND e.id::text = (storage.foldername(name))[1]
    )
  );
