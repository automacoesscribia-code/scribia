// Story 3.2: Summary & Topic Segmentation
// Uses AI Provider (Gemini default, configurable via AI_PROVIDER)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callAIProvider } from '../_shared/ai-provider.ts'

const MAX_RETRIES = 3
const BACKOFF_BASE = 5000

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Fetch next queued summary job
    const { data: job } = await supabase
      .from('processing_jobs')
      .select('*, lectures(id, transcript_text, title)')
      .eq('type', 'summary')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!job) {
      return new Response(JSON.stringify({ message: 'No pending jobs' }), { status: 200 })
    }

    const lecture = (job as any).lectures
    if (!lecture?.transcript_text) {
      await supabase.from('processing_jobs').update({ status: 'failed', error_message: 'No transcript available' }).eq('id', job.id)
      return new Response(JSON.stringify({ error: 'No transcript' }), { status: 400 })
    }

    await supabase.from('processing_jobs').update({ status: 'processing' }).eq('id', job.id)

    // Generate summary via AI
    const prompt = `Analise a transcrição da palestra "${lecture.title}" abaixo e gere:
1. Um resumo executivo (300-500 palavras) capturando os pontos principais
2. Uma lista de tópicos abordados na palestra, em ordem cronológica

Responda APENAS com JSON válido no formato:
{ "summary": "texto do resumo...", "topics": ["Tópico 1: ...", "Tópico 2: ..."] }

TRANSCRIÇÃO:
${lecture.transcript_text.slice(0, 100000)}`

    let result: { summary: string; topics: string[] } | null = null
    let lastError = ''

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const text = await callAIProvider(prompt, { temperature: 0.3, maxTokens: 4096, jsonMode: true })
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('No JSON found in response')
        result = JSON.parse(jsonMatch[0])
        break
      } catch (e) {
        lastError = String(e)
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, BACKOFF_BASE * Math.pow(3, attempt)))
        }
      }
    }

    if (!result) {
      await supabase.from('processing_jobs').update({ status: 'failed', error_message: lastError }).eq('id', job.id)
      return new Response(JSON.stringify({ error: 'AI generation failed' }), { status: 500 })
    }

    // Save results
    await supabase
      .from('lectures')
      .update({
        summary: result.summary,
        topics: result.topics,
        processing_progress: 50,
      })
      .eq('id', lecture.id)

    await supabase.from('processing_jobs').update({ status: 'completed' }).eq('id', job.id)

    return new Response(JSON.stringify({ success: true, topics_count: result.topics.length }), { status: 200 })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})

