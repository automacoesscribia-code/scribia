-- ============================================
-- ScribIA: Add speaker role to the system
-- Epic 8 - Story 8.1: Speaker Role Database
-- ============================================

-- 1. Add 'speaker' to user_role ENUM
-- NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction in Postgres.
-- Supabase migrations run each file as a single transaction by default,
-- but ADD VALUE is special-cased to work outside transactions.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'speaker';

-- 2. Add user_id column to speakers table (links speaker record to auth account)
-- Nullable: starts NULL until speaker accepts invitation and creates account
ALTER TABLE public.speakers
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.user_profiles(id);

CREATE INDEX IF NOT EXISTS idx_speakers_user_id ON public.speakers(user_id);

-- 3. Update invitations table to accept 'speaker' role
-- Drop old CHECK constraint and recreate with 'speaker' included
ALTER TABLE public.invitations
  DROP CONSTRAINT IF EXISTS invitations_role_check;

ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_role_check
  CHECK (role IN ('organizer', 'participant', 'speaker'));

-- 4. Add speaker_id to invitations (links invitation to specific speaker record)
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS speaker_id UUID REFERENCES public.speakers(id);

-- ============================================
-- 5. Helper function: is_speaker()
-- ============================================

CREATE OR REPLACE FUNCTION public.is_speaker()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND 'speaker'::public.user_role = ANY(roles)
  );
$$;

-- ============================================
-- 6. Update handle_new_user() trigger
--    Now handles speaker invitations:
--    - Sets role to 'speaker'
--    - Links speakers.user_id to the new auth user
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _role public.user_role := 'participant';
  _invitation RECORD;
BEGIN
  -- Check if user was invited
  SELECT INTO _invitation id, role, event_id, speaker_id
  FROM public.invitations
  WHERE email = NEW.email
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    _role := _invitation.role::public.user_role;

    UPDATE public.invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = _invitation.id;
  END IF;

  -- Allow role override from auth metadata
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    _role := (NEW.raw_user_meta_data->>'role')::public.user_role;
  END IF;

  -- Safety: never auto-assign super_admin
  IF _role = 'super_admin' THEN
    _role := 'participant';
  END IF;

  INSERT INTO public.user_profiles (id, email, full_name, roles)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    ARRAY[_role]
  );

  -- If participant invited to specific event, auto-register
  IF _invitation.event_id IS NOT NULL AND _role = 'participant' THEN
    INSERT INTO public.event_participants (event_id, user_id)
    VALUES (_invitation.event_id, NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- If speaker invited, link the speaker record to the new user account
  IF _role = 'speaker' AND _invitation.speaker_id IS NOT NULL THEN
    UPDATE public.speakers
    SET user_id = NEW.id
    WHERE id = _invitation.speaker_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. Update validate_invitation_authority()
--    Now allows organizers and super_admin to invite speakers
-- ============================================

CREATE OR REPLACE FUNCTION public.validate_invitation_authority()
RETURNS TRIGGER AS $$
DECLARE
  _inviter_roles public.user_role[];
BEGIN
  SELECT roles INTO _inviter_roles
  FROM public.user_profiles
  WHERE id = NEW.invited_by;

  -- Only super_admin can invite organizers
  IF NEW.role = 'organizer' AND NOT ('super_admin'::public.user_role = ANY(_inviter_roles)) THEN
    RAISE EXCEPTION 'Only super_admin can invite organizers';
  END IF;

  -- Only organizers or super_admin can invite participants
  IF NEW.role = 'participant' THEN
    IF NOT ('super_admin'::public.user_role = ANY(_inviter_roles))
       AND NOT ('organizer'::public.user_role = ANY(_inviter_roles)) THEN
      RAISE EXCEPTION 'Only organizers can invite participants';
    END IF;
    IF 'organizer'::public.user_role = ANY(_inviter_roles)
       AND NOT ('super_admin'::public.user_role = ANY(_inviter_roles))
       AND NEW.event_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.events
        WHERE id = NEW.event_id AND organizer_id = NEW.invited_by
      ) THEN
        RAISE EXCEPTION 'Organizer can only invite to own events';
      END IF;
    END IF;
  END IF;

  -- Only organizers or super_admin can invite speakers
  IF NEW.role = 'speaker' THEN
    IF NOT ('super_admin'::public.user_role = ANY(_inviter_roles))
       AND NOT ('organizer'::public.user_role = ANY(_inviter_roles)) THEN
      RAISE EXCEPTION 'Only organizers can invite speakers';
    END IF;
    -- Organizer must own the event (if event_id provided)
    IF 'organizer'::public.user_role = ANY(_inviter_roles)
       AND NOT ('super_admin'::public.user_role = ANY(_inviter_roles))
       AND NEW.event_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.events
        WHERE id = NEW.event_id AND organizer_id = NEW.invited_by
      ) THEN
        RAISE EXCEPTION 'Organizer can only invite speakers to own events';
      END IF;
    END IF;
    -- speaker_id is required for speaker invitations
    IF NEW.speaker_id IS NULL THEN
      RAISE EXCEPTION 'speaker_id is required for speaker invitations';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. RLS policies for speakers
-- ============================================

-- Speaker can read their own speaker record
CREATE POLICY speakers_read_own ON public.speakers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Speaker can update their own bio/avatar
CREATE POLICY speakers_update_own ON public.speakers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Speaker can read lectures assigned to them
CREATE POLICY lectures_speaker_read ON public.lectures
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.speakers s
      WHERE s.id = speaker_id
        AND s.user_id = auth.uid()
    )
  );

-- Speaker can read events that have lectures assigned to them
CREATE POLICY events_speaker_read ON public.events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lectures l
      JOIN public.speakers s ON s.id = l.speaker_id
      WHERE l.event_id = id
        AND s.user_id = auth.uid()
    )
  );

-- ============================================
-- 9. Grant permissions for new column
-- ============================================

-- Ensure authenticated users can read speaker_id from invitations
-- (already covered by existing grants on invitations table)

-- ============================================
-- ROLLBACK (if needed)
-- ============================================
-- DROP POLICY IF EXISTS events_speaker_read ON public.events;
-- DROP POLICY IF EXISTS lectures_speaker_read ON public.lectures;
-- DROP POLICY IF EXISTS speakers_update_own ON public.speakers;
-- DROP POLICY IF EXISTS speakers_read_own ON public.speakers;
-- DROP FUNCTION IF EXISTS public.is_speaker();
-- ALTER TABLE public.invitations DROP COLUMN IF EXISTS speaker_id;
-- ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_role_check;
-- ALTER TABLE public.invitations ADD CONSTRAINT invitations_role_check CHECK (role IN ('organizer', 'participant'));
-- ALTER TABLE public.speakers DROP COLUMN IF EXISTS user_id;
-- NOTE: Cannot remove enum value in PostgreSQL — 'speaker' will remain in enum
