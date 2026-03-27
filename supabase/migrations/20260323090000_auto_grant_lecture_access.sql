-- ============================================
-- ScribIA: Auto-grant lecture_access when participant joins event
-- Complements existing trigger (20260319124552) which grants access
-- when a new lecture is created. This one handles the inverse:
-- when a participant is added to an event, grant access to ALL
-- existing lectures in that event.
--
-- Covers all participant registration flows:
--   - Direct add by organizer (participants-tab)
--   - Invitation acceptance (handle_new_user trigger)
--   - CSV import
-- ============================================

CREATE OR REPLACE FUNCTION public.auto_grant_lecture_access_on_participant()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.lecture_access (lecture_id, user_id)
  SELECT l.id, NEW.user_id
  FROM public.lectures l
  WHERE l.event_id = NEW.event_id
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_auto_grant_lecture_access_on_participant
  AFTER INSERT ON public.event_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_grant_lecture_access_on_participant();

-- ============================================
-- ROLLBACK (if needed)
-- ============================================
-- DROP TRIGGER IF EXISTS trg_auto_grant_lecture_access_on_participant ON public.event_participants;
-- DROP FUNCTION IF EXISTS public.auto_grant_lecture_access_on_participant();
