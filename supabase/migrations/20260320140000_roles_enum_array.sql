-- ============================================
-- ScribIA: Migrate role from TEXT to ENUM array
-- Prevents typos: only valid values accepted
-- Allows multiple roles per user
-- ============================================

-- 1. Create ENUM type
CREATE TYPE public.user_role AS ENUM ('super_admin', 'organizer', 'participant');

-- 2. Drop existing CHECK constraint (from previous migration)
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- 3. Add new column as array of enum
ALTER TABLE public.user_profiles
  ADD COLUMN roles public.user_role[] NOT NULL DEFAULT '{participant}';

-- 4. Migrate existing data: copy role TEXT → roles ENUM[]
UPDATE public.user_profiles
SET roles = ARRAY[role::public.user_role];

-- 5. Drop old TEXT column
ALTER TABLE public.user_profiles
  DROP COLUMN role;

-- 6. Add constraint: must have at least one role
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_roles_not_empty
  CHECK (array_length(roles, 1) > 0);

-- 7. Index for role-based queries (GIN for array containment)
CREATE INDEX idx_user_profiles_roles ON public.user_profiles USING GIN (roles);

-- ============================================
-- 8. Update helper functions to use array
-- ============================================

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND 'super_admin'::public.user_role = ANY(roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT roles FROM public.user_profiles
  WHERE id = auth.uid();
$$;

-- Helper: check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(check_role public.user_role)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND check_role = ANY(roles)
  );
$$;

-- ============================================
-- 9. Update handle_new_user trigger
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _role public.user_role := 'participant';
  _invitation RECORD;
BEGIN
  -- Check if user was invited
  SELECT INTO _invitation id, role, event_id
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. Update role elevation trigger
-- ============================================

CREATE OR REPLACE FUNCTION public.prevent_role_self_elevation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.roles IS DISTINCT FROM NEW.roles THEN
    IF NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'Only super_admin can change user roles';
    END IF;
    -- Cannot add super_admin role unless you are super_admin
    IF 'super_admin'::public.user_role = ANY(NEW.roles)
       AND NOT ('super_admin'::public.user_role = ANY(OLD.roles)) THEN
      IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Cannot add super_admin role';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. Update invitation authority trigger
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
    -- Organizer must own the event
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 12. Update RLS policies that reference role
-- ============================================

-- organizers_read_event_participants already uses organizer_id, not role column — OK
-- is_super_admin() already updated — all super_admin policies work via function

-- ============================================
-- ROLLBACK
-- ============================================
-- ALTER TABLE public.user_profiles ADD COLUMN role TEXT;
-- UPDATE public.user_profiles SET role = roles[1]::TEXT;
-- ALTER TABLE public.user_profiles ALTER COLUMN role SET NOT NULL;
-- ALTER TABLE public.user_profiles ALTER COLUMN role SET DEFAULT 'participant';
-- ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_roles_not_empty;
-- ALTER TABLE public.user_profiles DROP COLUMN roles;
-- DROP INDEX IF EXISTS idx_user_profiles_roles;
-- DROP FUNCTION IF EXISTS public.has_role(public.user_role);
-- DROP TYPE IF EXISTS public.user_role;
-- ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check CHECK (role IN ('super_admin', 'organizer', 'participant'));
