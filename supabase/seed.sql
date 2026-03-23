-- ScribIA Seed Data
-- Note: In production, user_profiles are created via auth trigger.
-- For local dev, we insert directly since auth.users won't exist in seed.

-- 1 Super Admin (Scribia owner)
INSERT INTO public.user_profiles (id, email, full_name, role) VALUES
  ('00000000-0000-0000-0000-000000000000', 'admin@scribia.dev', 'Admin Scribia', 'super_admin');

-- 1 Organizer
INSERT INTO public.user_profiles (id, email, full_name, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'organizer@scribia.dev', 'Ana Organizadora', 'organizer');

-- 2 Participants
INSERT INTO public.user_profiles (id, email, full_name, role) VALUES
  ('00000000-0000-0000-0000-000000000002', 'joao@scribia.dev', 'João Participante', 'participant'),
  ('00000000-0000-0000-0000-000000000003', 'maria@scribia.dev', 'Maria Participante', 'participant');

-- 1 Event
INSERT INTO public.events (id, organizer_id, name, description, start_date, end_date, location, status) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'Tech Summit 2026', 'Conferência de tecnologia e inovação',
   '2026-04-15 09:00:00+00', '2026-04-15 18:00:00+00', 'São Paulo, SP', 'active');

-- 2 Speakers
INSERT INTO public.speakers (id, name, email, bio, company, role) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Dr. Carlos Silva', 'carlos@example.com',
   'Especialista em IA com 15 anos de experiência', 'TechCorp', 'CTO'),
  ('20000000-0000-0000-0000-000000000002', 'Profa. Lucia Santos', 'lucia@example.com',
   'Professora de Engenharia de Software na USP', 'USP', 'Professora');

-- 3 Lectures
INSERT INTO public.lectures (id, event_id, speaker_id, title, description, scheduled_at, status) VALUES
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', 'IA Generativa na Prática',
   'Como aplicar modelos de linguagem em produtos reais',
   '2026-04-15 10:00:00+00', 'scheduled'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000002', 'Arquitetura de Software Moderna',
   'Padrões e práticas para sistemas escaláveis',
   '2026-04-15 14:00:00+00', 'scheduled'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', 'Workshop: Construindo com LLMs',
   'Hands-on de integração com APIs de IA',
   '2026-04-15 16:00:00+00', 'scheduled');

-- 2 Event Participants
INSERT INTO public.event_participants (event_id, user_id) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003');

-- Lecture access for participants (all 3 lectures)
INSERT INTO public.lecture_access (lecture_id, user_id) VALUES
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003'),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003');
