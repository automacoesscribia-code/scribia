-- ============================================
-- ScribIA: 3-Role System (super_admin, organizer, participant)
--
-- Hierarchy:
--   super_admin (Scribia owner)
--     └── invites → organizer (pays for service)
--          ├── creates events
--          ├── invites speakers
--          └── links → participant (to specific events)
--               └── views + downloads products
--
-- ROLLBACK: See bottom of file for rollback statements
-- ============================================

-- ============================================
-- 1. ALTER user_profiles: add super_admin role
-- ============================================

-- Drop existing CHECK constraint and recreate with 3 roles
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('super_admin', 'organizer', 'participant'));

-- ============================================
-- 2. Helper functions
-- ============================================

-- Check if current user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

-- Get current user's role (cached per statement)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT role FROM public.user_profiles
  WHERE id = auth.uid();
$$;

-- ============================================
-- 3. Invitations table
-- ============================================

CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('organizer', 'participant')),
  invited_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  token UUID NOT NULL DEFAULT uuid_generate_v4(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Organizer invites don't need event_id; participant invites do
  CONSTRAINT invitations_participant_needs_event
    CHECK (role = 'organizer' OR event_id IS NOT NULL)
);

-- Indexes
CREATE UNIQUE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_invitations_invited_by ON public.invitations(invited_by);
CREATE INDEX idx_invitations_status ON public.invitations(status);

-- RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Super admin can manage all invitations
CREATE POLICY "super_admin_manage_invitations"
  ON public.invitations FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Organizers can manage their own invitations (participant invites only)
CREATE POLICY "organizers_manage_own_invitations"
  ON public.invitations FOR ALL
  USING (auth.uid() = invited_by AND role = 'participant')
  WITH CHECK (auth.uid() = invited_by AND role = 'participant');

-- Anyone can view invitations sent to their email (for accepting)
CREATE POLICY "users_view_own_invitations"
  ON public.invitations FOR SELECT
  USING (
    email = (SELECT email FROM public.user_profiles WHERE id = auth.uid())
  );

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO service_role;

-- Updated_at trigger
CREATE TRIGGER set_updated_at_invitations
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 4. UPDATE RLS: user_profiles
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "users_read_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;

-- Users read own profile
CREATE POLICY "users_read_own_profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Super admin reads ALL profiles
CREATE POLICY "super_admin_read_all_profiles"
  ON public.user_profiles FOR SELECT
  USING (public.is_super_admin());

-- Super admin can update any profile (e.g., promote to organizer)
CREATE POLICY "super_admin_update_profiles"
  ON public.user_profiles FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Users update own profile (but cannot change their own role)
CREATE POLICY "users_update_own_profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Organizers can read profiles of participants in their events
CREATE POLICY "organizers_read_event_participants"
  ON public.user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_participants ep
      JOIN public.events e ON e.id = ep.event_id
      WHERE ep.user_id = user_profiles.id
        AND e.organizer_id = auth.uid()
    )
  );

-- ============================================
-- 5. UPDATE RLS: events (add super_admin access)
-- ============================================

-- Super admin can see all events
CREATE POLICY "super_admin_manage_events"
  ON public.events FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================
-- 6. UPDATE RLS: lectures (add super_admin access)
-- ============================================

CREATE POLICY "super_admin_manage_lectures"
  ON public.lectures FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================
-- 7. UPDATE RLS: speakers (add super_admin access)
-- ============================================

CREATE POLICY "super_admin_manage_speakers"
  ON public.speakers FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================
-- 8. UPDATE RLS: event_participants (add super_admin access)
-- ============================================

CREATE POLICY "super_admin_manage_participants"
  ON public.event_participants FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================
-- 9. UPDATE RLS: lecture_access (add super_admin access)
-- ============================================

CREATE POLICY "super_admin_manage_lecture_access"
  ON public.lecture_access FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================
-- 10. UPDATE RLS: processing_jobs (add super_admin access)
-- ============================================

CREATE POLICY "super_admin_manage_jobs"
  ON public.processing_jobs FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================
-- 11. UPDATE RLS: storage (add super_admin access)
-- ============================================

CREATE POLICY "super_admin_read_audio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audio-files' AND public.is_super_admin());

CREATE POLICY "super_admin_read_materials"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'materials' AND public.is_super_admin());

-- ============================================
-- 12. UPDATE trigger: handle_new_user
-- Support role from invitation metadata
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _role TEXT := 'participant';
  _invitation RECORD;
BEGIN
  -- Check if user was invited (by email match on pending invitation)
  SELECT INTO _invitation id, role, event_id
  FROM public.invitations
  WHERE email = NEW.email
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    _role := _invitation.role;

    -- Mark invitation as accepted
    UPDATE public.invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = _invitation.id;
  END IF;

  -- Allow role override from auth metadata (for manual setup)
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    _role := NEW.raw_user_meta_data->>'role';
  END IF;

  -- Safety: never auto-assign super_admin
  IF _role = 'super_admin' THEN
    _role := 'participant';
  END IF;

  -- Create profile
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    _role
  );

  -- If participant was invited to a specific event, auto-register
  IF _invitation.event_id IS NOT NULL AND _role = 'participant' THEN
    INSERT INTO public.event_participants (event_id, user_id)
    VALUES (_invitation.event_id, NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 13. Validation trigger: prevent role self-elevation
-- ============================================

CREATE OR REPLACE FUNCTION public.prevent_role_self_elevation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only super_admin can change roles
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'Only super_admin can change user roles';
    END IF;
    -- Nobody can self-promote to super_admin via UPDATE
    IF NEW.role = 'super_admin' AND OLD.role != 'super_admin' THEN
      -- Only existing super_admins can promote others
      IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Cannot promote to super_admin';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER check_role_elevation
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_elevation();

-- ============================================
-- 14. Validation trigger: invitation authority
-- Only super_admin can invite organizers
-- Only organizers can invite participants
-- ============================================

CREATE OR REPLACE FUNCTION public.validate_invitation_authority()
RETURNS TRIGGER AS $$
DECLARE
  _inviter_role TEXT;
BEGIN
  SELECT role INTO _inviter_role
  FROM public.user_profiles
  WHERE id = NEW.invited_by;

  -- Super admin can invite organizers
  IF NEW.role = 'organizer' AND _inviter_role != 'super_admin' THEN
    RAISE EXCEPTION 'Only super_admin can invite organizers';
  END IF;

  -- Organizers can invite participants (must own the event)
  IF NEW.role = 'participant' THEN
    IF _inviter_role NOT IN ('super_admin', 'organizer') THEN
      RAISE EXCEPTION 'Only organizers can invite participants';
    END IF;
    -- If organizer, must own the event
    IF _inviter_role = 'organizer' AND NEW.event_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.events
        WHERE id = NEW.event_id AND organizer_id = NEW.invited_by
      ) THEN
        RAISE EXCEPTION 'Organizer can only invite to own events';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER check_invitation_authority
  BEFORE INSERT ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.validate_invitation_authority();

-- ============================================
-- ROLLBACK (run manually if needed)
-- ============================================
-- DROP TRIGGER IF EXISTS check_invitation_authority ON public.invitations;
-- DROP FUNCTION IF EXISTS public.validate_invitation_authority();
-- DROP TRIGGER IF EXISTS check_role_elevation ON public.user_profiles;
-- DROP FUNCTION IF EXISTS public.prevent_role_self_elevation();
-- DROP TABLE IF EXISTS public.invitations;
-- DROP POLICY IF EXISTS "super_admin_manage_invitations" ON public.invitations;
-- DROP POLICY IF EXISTS "super_admin_read_all_profiles" ON public.user_profiles;
-- DROP POLICY IF EXISTS "super_admin_update_profiles" ON public.user_profiles;
-- DROP POLICY IF EXISTS "organizers_read_event_participants" ON public.user_profiles;
-- DROP POLICY IF EXISTS "super_admin_manage_events" ON public.events;
-- DROP POLICY IF EXISTS "super_admin_manage_lectures" ON public.lectures;
-- DROP POLICY IF EXISTS "super_admin_manage_speakers" ON public.speakers;
-- DROP POLICY IF EXISTS "super_admin_manage_participants" ON public.event_participants;
-- DROP POLICY IF EXISTS "super_admin_manage_lecture_access" ON public.lecture_access;
-- DROP POLICY IF EXISTS "super_admin_manage_jobs" ON public.processing_jobs;
-- DROP POLICY IF EXISTS "super_admin_read_audio" ON storage.objects;
-- DROP POLICY IF EXISTS "super_admin_read_materials" ON storage.objects;
-- DROP FUNCTION IF EXISTS public.is_super_admin();
-- DROP FUNCTION IF EXISTS public.get_user_role();
-- ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_role_check;
-- ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check CHECK (role IN ('organizer', 'participant'));
