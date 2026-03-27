-- Add ebook_content and playbook_content columns to store raw markdown
-- This enables re-generation of PDF/DOCX without re-calling AI
ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS ebook_content text,
  ADD COLUMN IF NOT EXISTS playbook_content text;

COMMENT ON COLUMN public.lectures.ebook_content IS 'Raw markdown content of the generated ebook';
COMMENT ON COLUMN public.lectures.playbook_content IS 'Raw markdown content of the generated playbook';
