import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.24.0'
import {
  parsePlaceholders,
  generateEbookImages,
  replacePlaceholdersWithUrls,
  type EbookImageContext,
} from '../_shared/ebook-images.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProcessRequest {
  lecture_id: string
  steps?: ('transcribe' | 'summarize' | 'ebook' | 'playbook')[]
}

// Default prompts (used when DB prompts are not available)
const DEFAULT_PROMPTS: Record<string, string> = {
  summary: `Analise esta transcrição de palestra e gere:

1. Um resumo de 3-5 parágrafos
2. Uma lista de 5-10 tópicos principais abordados

Título da palestra: {{title}}

Transcrição:
{{transcript}}

Responda em JSON com o formato:
{
  "summary": "resumo aqui...",
  "topics": ["tópico 1", "tópico 2", ...]
}`,
  ebook: `Você é um editor profissional de e-books educacionais. Crie um e-book baseado EXCLUSIVAMENTE no conteúdo da transcrição abaixo. NÃO invente informações, dados ou citações que não estejam na transcrição.

## Dados da palestra
- **Título:** {{title}}
- **Palestrante:** {{speaker}}
- **Evento:** {{event}}
- **Resumo:** {{summary}}
- **Tópicos:** {{topics}}

## Transcrição completa
{{transcript}}

## Instruções de geração

Gere um e-book em Markdown seguindo EXATAMENTE esta estrutura:

### 1. CAPA (obrigatória)
\`\`\`
# {{título do ebook}}

**Por:** {{speaker}}
**Evento:** {{event}}
**Gerado por:** ScribIA

---
\`\`\`

### 2. SUMÁRIO
Liste os capítulos com links âncora Markdown.

### 3. INTRODUÇÃO
- Contextualize o tema da palestra (2-3 parágrafos)
- Explique o que o leitor vai aprender
- Após a introdução, insira: \`<!-- IMAGE: intro | Uma ilustração conceitual sobre [tema principal da palestra] -->\`

### 4. CAPÍTULOS (3-6 capítulos, baseados nos tópicos)
Para cada capítulo:
- **Título** como ## heading
- **Subtítulos** como ### heading para organizar o conteúdo
- **Conteúdo** expandido a partir da transcrição (NÃO invente)
- **Citações diretas** do palestrante usando > blockquote quando relevante
- **Pontos-chave** ao final do capítulo em lista com **negrito**
- Após cada capítulo, insira: \`<!-- IMAGE: chapter-N | Descrição visual relevante ao conteúdo do capítulo -->\`

### 5. CONCLUSÃO
- Síntese dos principais aprendizados
- Próximos passos sugeridos pelo palestrante (se mencionados)

### 6. SOBRE O PALESTRANTE
- Breve bio baseada APENAS no que foi mencionado na transcrição

## Regras de formatação
- Use **negrito** para termos e conceitos importantes
- Use *itálico* para ênfase
- Use > blockquote para citações diretas do palestrante
- Use listas (- ou 1.) para enumerar pontos
- Use --- para separar seções principais
- Use emojis moderadamente para marcar seções (📌 para pontos-chave, 💡 para insights, 🎯 para objetivos)
- Tom: profissional, acessível, em português brasileiro
- Tamanho: 3000-6000 palavras

## Regras de fidelidade
- NUNCA invente dados, estatísticas ou citações
- NUNCA adicione informações que não estejam na transcrição
- Se a transcrição for vaga sobre um ponto, diga "conforme mencionado na palestra" em vez de inventar detalhes
- Priorize citações diretas do palestrante quando possível`,
  playbook: `Crie um playbook prático e acionável baseado nesta palestra.

Título: {{title}}
Palestrante: {{speaker}}
Resumo: {{summary}}

Transcrição:
{{transcript}}

Gere um playbook em Markdown com:
- Título e contexto
- 5-10 ações práticas com checklists (usando - [ ] para cada item)
- Para cada ação: descrição, por que é importante, como implementar
- Métricas de sucesso
- Timeline sugerida

Use formatação Markdown com checklists interativos.`,
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 8192
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value)
  }
  return result
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Auth check
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const { lecture_id, steps = ['transcribe', 'summarize', 'ebook', 'playbook'] }: ProcessRequest = await req.json()

    // Fetch lecture
    const { data: lecture, error: lectureErr } = await supabase
      .from('lectures')
      .select('*, events(id, name)')
      .eq('id', lecture_id)
      .single()

    if (lectureErr || !lecture) {
      return jsonResponse({ error: 'Lecture not found' }, 404)
    }

    const eventId = lecture.event_id

    // Initialize Gemini
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) {
      return jsonResponse({ error: 'GEMINI_API_KEY not configured' }, 500)
    }
    const genAI = new GoogleGenerativeAI(geminiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    // Load custom prompts from DB
    const { data: dbPrompts } = await supabase
      .from('system_prompts')
      .select('key, prompt_text')

    const promptMap: Record<string, string> = { ...DEFAULT_PROMPTS }
    if (dbPrompts) {
      for (const p of dbPrompts as Array<{ key: string; prompt_text: string }>) {
        promptMap[p.key] = p.prompt_text
      }
    }

    // Update status
    await updateLecture(supabase, lecture_id, { status: 'processing', processing_progress: 0 })

    const results: Record<string, string> = {}

    // ========================
    // STEP 1: Transcribe audio
    // ========================
    if (steps.includes('transcribe')) {
      await updateLecture(supabase, lecture_id, { processing_progress: 5 })

      // List audio chunks from storage
      const { data: audioFiles } = await supabase.storage
        .from('audio-files')
        .list(`${eventId}/${lecture_id}`)

      const chunks = (audioFiles ?? [])
        .filter((f: { name: string }) => f.name.endsWith('.wav'))
        .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))

      if (chunks.length === 0) {
        return jsonResponse({ error: 'No audio files found for this lecture' }, 400)
      }

      // Update audio_path if not set
      await updateLecture(supabase, lecture_id, {
        audio_path: `${eventId}/${lecture_id}`,
      })

      let fullTranscript = ''

      for (let i = 0; i < chunks.length; i++) {
        const chunkPath = `${eventId}/${lecture_id}/${chunks[i].name}`
        const { data: audioData } = await supabase.storage
          .from('audio-files')
          .download(chunkPath)

        if (!audioData) continue

        const audioBytes = await audioData.arrayBuffer()
        const base64Audio = uint8ArrayToBase64(new Uint8Array(audioBytes))

        const transcribeResult = await model.generateContent([
          {
            inlineData: {
              mimeType: 'audio/wav',
              data: base64Audio,
            },
          },
          'Transcreva este áudio em português brasileiro. Retorne apenas o texto transcrito, sem timestamps ou formatação extra.',
        ])

        const chunkText = transcribeResult.response.text()
        fullTranscript += (fullTranscript ? ' ' : '') + chunkText

        const progress = 5 + Math.round((i + 1) / chunks.length * 20)
        await updateLecture(supabase, lecture_id, { processing_progress: progress })
      }

      await updateLecture(supabase, lecture_id, {
        transcript_text: fullTranscript,
        processing_progress: 25,
      })
      results.transcribe = 'ok'
    }

    // ========================
    // STEP 2: Generate summary + topics
    // ========================
    if (steps.includes('summarize')) {
      await updateLecture(supabase, lecture_id, { processing_progress: 30 })

      const { data: updated } = await supabase
        .from('lectures')
        .select('transcript_text, title')
        .eq('id', lecture_id)
        .single()

      const transcript = (updated as { transcript_text: string | null })?.transcript_text
      if (!transcript) {
        results.summarize = 'skipped - no transcript'
      } else {
        const summaryPrompt = fillTemplate(promptMap.summary, {
          title: (updated as { title: string }).title,
          transcript: transcript.substring(0, 30000),
        })

        const summaryResult = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [{ text: summaryPrompt }]
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.3,
          },
        })

        const summaryData = JSON.parse(summaryResult.response.text())
        await updateLecture(supabase, lecture_id, {
          summary: summaryData.summary,
          topics: summaryData.topics,
          processing_progress: 50,
        })
        results.summarize = 'ok'
      }
    }

    // ========================
    // STEP 3: Generate E-book
    // ========================
    if (steps.includes('ebook')) {
      await updateLecture(supabase, lecture_id, { processing_progress: 55 })

      const { data: forEbook } = await supabase
        .from('lectures')
        .select('title, transcript_text, summary, topics, speakers(name), events(name)')
        .eq('id', lecture_id)
        .single()

      const d = forEbook as any
      if (d?.transcript_text) {
        const ebookPrompt = fillTemplate(promptMap.ebook, {
          title: d.title ?? '',
          speaker: d.speakers?.name ?? 'N/A',
          event: d.events?.name ?? 'N/A',
          summary: d.summary ?? '',
          topics: (d.topics ?? []).join(', '),
          transcript: d.transcript_text.substring(0, 30000),
        })

        const ebookResult = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [{ text: ebookPrompt }]
          }],
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.7,
          },
        })

        let ebookContent = ebookResult.response.text()

        await updateLecture(supabase, lecture_id, { processing_progress: 65 })

        // ── Generate ebook images from placeholders ──
        const imageCtx: EbookImageContext = {
          title: d.title ?? '',
          speaker: d.speakers?.name ?? 'N/A',
          event: d.events?.name ?? 'N/A',
          summary: d.summary ?? '',
        }

        const placeholders = parsePlaceholders(ebookContent)

        // Ensure footer placeholder exists (mandatory branding)
        const hasFooter = placeholders.some(p => p.type === 'footer')
        if (!hasFooter) {
          ebookContent += '\n\n---\n\n<!-- IMAGE: footer | Rodapé ScribIA com logo e tagline -->'
          placeholders.push({
            type: 'footer',
            id: 'footer',
            description: 'Rodapé ScribIA com logo e tagline',
            raw: '<!-- IMAGE: footer | Rodapé ScribIA com logo e tagline -->',
          })
        }

        const generatedImages = generateEbookImages(imageCtx, placeholders, `${eventId}/${lecture_id}`)

        // Upload each SVG image to storage
        const urlMap = new Map<string, string>()
        for (const img of generatedImages) {
          await supabase.storage
            .from('materials')
            .upload(img.storagePath, new TextEncoder().encode(img.svg), {
              contentType: 'image/svg+xml; charset=utf-8',
              upsert: true,
            })

          // Generate a signed URL (7 days expiry for viewer)
          const { data: signedData } = await supabase.storage
            .from('materials')
            .createSignedUrl(img.storagePath, 60 * 60 * 24 * 7)

          if (signedData?.signedUrl) {
            urlMap.set(img.placeholder.id, signedData.signedUrl)
          }
        }

        // Replace placeholders with actual image URLs
        ebookContent = replacePlaceholdersWithUrls(ebookContent, generatedImages, urlMap)

        await updateLecture(supabase, lecture_id, { processing_progress: 70 })

        // Save final markdown with embedded image URLs
        const ebookPath = `${eventId}/${lecture_id}/ebook.md`
        await supabase.storage
          .from('materials')
          .upload(ebookPath, new TextEncoder().encode(ebookContent), {
            contentType: 'text/markdown; charset=utf-8',
            upsert: true,
          })

        // Store the storage path (NOT signed URL — we generate signed URLs on download)
        await updateLecture(supabase, lecture_id, {
          ebook_url: ebookPath,
          processing_progress: 75,
        })
        results.ebook = 'ok'
      }
    }

    // ========================
    // STEP 4: Generate Playbook
    // ========================
    if (steps.includes('playbook')) {
      await updateLecture(supabase, lecture_id, { processing_progress: 80 })

      const { data: forPlaybook } = await supabase
        .from('lectures')
        .select('title, transcript_text, summary, topics, speakers(name)')
        .eq('id', lecture_id)
        .single()

      const p = forPlaybook as any
      if (p?.transcript_text) {
        const playbookPrompt = fillTemplate(promptMap.playbook, {
          title: p.title ?? '',
          speaker: p.speakers?.name ?? 'N/A',
          summary: p.summary ?? '',
          transcript: p.transcript_text.substring(0, 25000),
        })

        const playbookResult = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [{ text: playbookPrompt }]
          }],
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.5,
          },
        })

        const playbookContent = playbookResult.response.text()

        const playbookPath = `${eventId}/${lecture_id}/playbook.md`
        await supabase.storage
          .from('materials')
          .upload(playbookPath, new TextEncoder().encode(playbookContent), {
            contentType: 'text/markdown; charset=utf-8',
            upsert: true,
          })

        // Store the storage path (NOT signed URL)
        await updateLecture(supabase, lecture_id, {
          playbook_url: playbookPath,
          processing_progress: 95,
        })
        results.playbook = 'ok'
      }
    }

    // Mark as completed
    await updateLecture(supabase, lecture_id, {
      status: 'completed',
      processing_progress: 100,
    })

    return jsonResponse({ success: true, results })

  } catch (err) {
    console.error('Process error:', err)
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})

async function updateLecture(supabase: any, lectureId: string, updates: Record<string, any>) {
  await supabase
    .from('lectures')
    .update(updates)
    .eq('id', lectureId)
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
