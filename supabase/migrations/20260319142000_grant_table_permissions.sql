-- ScribIA: Grant DML permissions to Supabase roles
-- Fix: tables were missing SELECT/INSERT/UPDATE/DELETE grants
-- Without these, RLS policies have no effect (queries return empty)

-- Authenticated users: full DML (RLS controls row-level access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.speakers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lectures TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lecture_access TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processing_jobs TO authenticated;

-- Service role: full DML (bypasses RLS but still needs grants)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.speakers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lectures TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_participants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lecture_access TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processing_jobs TO service_role;

-- Anon role: read-only on select tables
GRANT SELECT ON public.user_profiles TO anon;
GRANT SELECT ON public.events TO anon;
GRANT SELECT ON public.speakers TO anon;
GRANT SELECT ON public.lectures TO anon;
