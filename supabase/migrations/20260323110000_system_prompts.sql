-- ============================================
-- ScribIA: System Prompts (customizable by super_admin)
-- Allows super_admin to edit AI generation prompts
-- ============================================

CREATE TABLE public.system_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  prompt_text TEXT NOT NULL,
  updated_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX idx_system_prompts_key ON public.system_prompts(key);

-- RLS
ALTER TABLE public.system_prompts ENABLE ROW LEVEL SECURITY;

-- Super admin can manage all prompts
CREATE POLICY "super_admin_manage_prompts"
  ON public.system_prompts FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Authenticated users can read prompts (edge functions need this via service_role)
CREATE POLICY "authenticated_read_prompts"
  ON public.system_prompts FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Service role full access (for edge functions)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_prompts TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.system_prompts TO authenticated;

-- Updated_at trigger
CREATE TRIGGER set_updated_at_system_prompts
  BEFORE UPDATE ON public.system_prompts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- Default prompts
-- ============================================

INSERT INTO public.system_prompts (key, name, description, prompt_text) VALUES
(
  'summary',
  'Resumo e Tópicos',
  'Prompt para gerar o resumo executivo e lista de tópicos a partir da transcrição',
  E'Analise esta transcrição de palestra e gere:\n\n1. Um resumo de 3-5 parágrafos\n2. Uma lista de 5-10 tópicos principais abordados\n\nTítulo da palestra: {{title}}\n\nTranscrição:\n{{transcript}}\n\nResponda em JSON com o formato:\n{\n  "summary": "resumo aqui...",\n  "topics": ["tópico 1", "tópico 2", ...]\n}'
),
(
  'ebook',
  'E-book',
  'Prompt para gerar o conteúdo do e-book em formato Markdown a partir da transcrição',
  E'Você é um editor profissional de e-books educacionais. Crie um e-book baseado EXCLUSIVAMENTE no conteúdo da transcrição abaixo. NÃO invente informações, dados ou citações que não estejam na transcrição.\n\n## Dados da palestra\n- **Título:** {{title}}\n- **Palestrante:** {{speaker}}\n- **Evento:** {{event}}\n- **Resumo:** {{summary}}\n- **Tópicos:** {{topics}}\n\n## Transcrição completa\n{{transcript}}\n\n## Instruções de geração\n\nGere um e-book em Markdown seguindo EXATAMENTE esta estrutura:\n\n### 1. CAPA (obrigatória)\n# {{título do ebook}}\n**Por:** {{speaker}}\n**Evento:** {{event}}\n**Gerado por:** ScribIA\n---\n\n### 2. SUMÁRIO\nListe os capítulos com links âncora Markdown.\n\n### 3. INTRODUÇÃO\n- Contextualize o tema da palestra (2-3 parágrafos)\n- Explique o que o leitor vai aprender\n- Após a introdução, insira: <!-- IMAGE: intro | Uma ilustração conceitual sobre [tema principal da palestra] -->\n\n### 4. CAPÍTULOS (3-6 capítulos, baseados nos tópicos)\nPara cada capítulo:\n- **Título** como ## heading\n- **Subtítulos** como ### heading\n- **Conteúdo** expandido a partir da transcrição (NÃO invente)\n- **Citações diretas** do palestrante usando > blockquote\n- **Pontos-chave** ao final em lista com **negrito**\n- Após cada capítulo, insira: <!-- IMAGE: chapter-N | Descrição visual relevante ao conteúdo do capítulo -->\n\n### 5. CONCLUSÃO\n- Síntese dos principais aprendizados\n- Próximos passos sugeridos pelo palestrante\n\n### 6. SOBRE O PALESTRANTE\n- Breve bio baseada APENAS no que foi mencionado na transcrição\n\n## Regras de formatação\n- Use **negrito** para termos importantes\n- Use *itálico* para ênfase\n- Use > blockquote para citações diretas\n- Use listas para enumerar pontos\n- Use --- para separar seções\n- Use emojis moderadamente (📌 pontos-chave, 💡 insights, 🎯 objetivos)\n- Tom: profissional, acessível, português brasileiro\n- Tamanho: 3000-6000 palavras\n\n## Regras de fidelidade\n- NUNCA invente dados, estatísticas ou citações\n- NUNCA adicione informações que não estejam na transcrição\n- Priorize citações diretas do palestrante quando possível'
),
(
  'playbook',
  'Playbook',
  'Prompt para gerar o playbook prático com checklists e ações',
  E'Crie um playbook prático e acionável baseado nesta palestra.\n\nTítulo: {{title}}\nPalestrante: {{speaker}}\nResumo: {{summary}}\n\nTranscrição:\n{{transcript}}\n\nGere um playbook em Markdown com:\n- Título e contexto\n- 5-10 ações práticas com checklists (usando - [ ] para cada item)\n- Para cada ação: descrição, por que é importante, como implementar\n- Métricas de sucesso\n- Timeline sugerida\n\nUse formatação Markdown com checklists interativos.'
),
(
  'card_image',
  'Card / Imagem OG',
  'Prompt para gerar a descrição visual do card de compartilhamento (usado para gerar imagem OG)',
  E'Gere um texto curto e impactante para o card de compartilhamento desta palestra.\n\nTítulo: {{title}}\nPalestrante: {{speaker}}\nResumo: {{summary}}\n\nO texto deve ter no máximo 2 frases que resumam o valor principal da palestra.\nResponda APENAS com o texto, sem formatação.'
);

-- ============================================
-- ROLLBACK
-- ============================================
-- DROP TRIGGER IF EXISTS set_updated_at_system_prompts ON public.system_prompts;
-- DROP TABLE IF EXISTS public.system_prompts;
