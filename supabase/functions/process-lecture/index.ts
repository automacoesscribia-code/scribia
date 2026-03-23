import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.24.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProcessRequest {
  lecture_id: string
  steps?: ('transcribe' | 'summarize' | 'ebook' | 'playbook')[]
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

      // Download first chunk for transcription (Gemini can process audio)
      let fullTranscript = ''

      for (let i = 0; i < chunks.length; i++) {
        const chunkPath = `${eventId}/${lecture_id}/${chunks[i].name}`
        const { data: audioData } = await supabase.storage
          .from('audio-files')
          .download(chunkPath)

        if (!audioData) continue

        const audioBytes = await audioData.arrayBuffer()
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBytes)))

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

      // Re-fetch to get transcript
      const { data: updated } = await supabase
        .from('lectures')
        .select('transcript_text, title')
        .eq('id', lecture_id)
        .single()

      const transcript = (updated as { transcript_text: string | null })?.transcript_text
      if (!transcript) {
        results.summarize = 'skipped - no transcript'
      } else {
        const summaryResult = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [{
              text: `Analise esta transcrição de palestra e gere:

1. Um resumo de 3-5 parágrafos
2. Uma lista de 5-10 tópicos principais abordados

Título da palestra: ${(updated as { title: string }).title}

Transcrição:
${transcript.substring(0, 30000)}

Responda em JSON com o formato:
{
  "summary": "resumo aqui...",
  "topics": ["tópico 1", "tópico 2", ...]
}`
            }]
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
        const ebookResult = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [{
              text: `Crie um e-book educacional completo baseado nesta palestra.

Título: ${d.title}
Palestrante: ${d.speakers?.name ?? 'N/A'}
Evento: ${d.events?.name ?? 'N/A'}
Resumo: ${d.summary ?? ''}
Tópicos: ${(d.topics ?? []).join(', ')}

Transcrição completa:
${d.transcript_text.substring(0, 30000)}

Gere um e-book em Markdown com:
- Título e autor
- Introdução
- Capítulos baseados nos tópicos (3-6 capítulos)
- Conclusão
- Pontos-chave de cada capítulo

Use formatação Markdown rica (headers, bold, listas, citações).`
            }]
          }],
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.7,
          },
        })

        const ebookContent = ebookResult.response.text()

        // Save as markdown file in storage
        const ebookPath = `${eventId}/${lecture_id}/ebook.md`
        await supabase.storage
          .from('materials')
          .upload(ebookPath, new TextEncoder().encode(ebookContent), {
            contentType: 'text/markdown',
            upsert: true,
          })

        const { data: ebookUrl } = await supabase.storage
          .from('materials')
          .createSignedUrl(ebookPath, 31536000) // 1 year

        await updateLecture(supabase, lecture_id, {
          ebook_url: ebookUrl?.signedUrl ?? ebookPath,
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
        const playbookResult = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [{
              text: `Crie um playbook prático e acionável baseado nesta palestra.

Título: ${p.title}
Palestrante: ${p.speakers?.name ?? 'N/A'}
Resumo: ${p.summary ?? ''}

Transcrição:
${p.transcript_text.substring(0, 25000)}

Gere um playbook em Markdown com:
- Título e contexto
- 5-10 ações práticas com checklists (usando - [ ] para cada item)
- Para cada ação: descrição, por que é importante, como implementar
- Métricas de sucesso
- Timeline sugerida

Use formatação Markdown com checklists interativos.`
            }]
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
            contentType: 'text/markdown',
            upsert: true,
          })

        const { data: playbookUrl } = await supabase.storage
          .from('materials')
          .createSignedUrl(playbookPath, 31536000)

        await updateLecture(supabase, lecture_id, {
          playbook_url: playbookUrl?.signedUrl ?? playbookPath,
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
