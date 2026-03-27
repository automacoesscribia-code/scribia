-- Function to completely delete a user from all tables + auth
-- Cleans: user_profiles (CASCADE: events, event_participants, invitations, lecture_access)
-- Nullifies: ai_settings.updated_by, system_prompts.updated_by, speakers.user_id
-- Deletes: invitations by email, auth.users

CREATE OR REPLACE FUNCTION public.delete_user_completely(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _email TEXT;
  _roles TEXT[];
BEGIN
  SELECT email, roles INTO _email, _roles
  FROM public.user_profiles
  WHERE id = target_user_id;

  IF _email IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  -- Nullify NO ACTION references
  UPDATE public.ai_settings SET updated_by = NULL WHERE updated_by = target_user_id;
  UPDATE public.system_prompts SET updated_by = NULL WHERE updated_by = target_user_id;
  UPDATE public.speakers SET user_id = NULL WHERE user_id = target_user_id;

  -- Delete invitations sent TO this email
  DELETE FROM public.invitations WHERE email = _email;

  -- Delete user_profiles (CASCADE handles dependent tables)
  DELETE FROM public.user_profiles WHERE id = target_user_id;

  -- Delete from auth
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_user', _email,
    'roles', to_jsonb(_roles)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_completely(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_completely(UUID) TO service_role;
