-- Fix: Allow users to accept invitations sent to their email
-- Previously only SELECT was allowed, so the acceptance update failed silently

CREATE POLICY "users_accept_own_invitations"
  ON public.invitations FOR UPDATE
  USING (
    email = (SELECT email FROM public.user_profiles WHERE id = auth.uid())
    AND status = 'pending'
  )
  WITH CHECK (
    email = (SELECT email FROM public.user_profiles WHERE id = auth.uid())
    AND status = 'accepted'
  );
