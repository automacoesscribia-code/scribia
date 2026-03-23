-- Story 4.3: Auto-grant lecture_access when new lecture is created
-- All existing event_participants automatically get access to new lectures

CREATE OR REPLACE FUNCTION public.auto_grant_lecture_access()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.lecture_access (lecture_id, user_id)
  SELECT NEW.id, ep.user_id
  FROM public.event_participants ep
  WHERE ep.event_id = NEW.event_id
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_lecture_created
  AFTER INSERT ON public.lectures
  FOR EACH ROW EXECUTE FUNCTION public.auto_grant_lecture_access();
