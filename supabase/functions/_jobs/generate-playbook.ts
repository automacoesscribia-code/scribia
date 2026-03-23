// Story 3.3: Playbook Generation
// Practical guide with checklists, action items, key takeaways

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1'

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: job } = await supabase
      .from('processing_jobs')
      .select('*, lectures(id, event_id, title, transcript_text, topics)')
      .eq('type', 'playbook')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!job) return new Response(JSON.stringify({ message: 'No pending jobs' }), { status: 200 })

    const lecture = (job as any).lectures
    await supabase.from('processing_jobs').update({ status: 'processing' }).eq('id', job.id)

    const prompt = `Gere um playbook prático a partir desta palestra.

Título: ${lecture.title}
Tópicos: ${(lecture.topics ?? []).join(', ')}

Estruture com:
- Objetivo: o que o leitor vai aprender
- Key Takeaways: 5-7 pontos principais
- Para cada tópico: resumo, checklist de ações, dicas
- Plano de ação: próximos passos concretos

Tom: direto, prático, actionable. Português brasileiro.

TRANSCRIÇÃO:
${(lecture.transcript_text ?? '').slice(0, 80000)}`

    const content = await callAI(prompt)
    if (!content) {
      await supabase.from('processing_jobs').update({ status: 'failed', error_message: 'Empty AI response' }).eq('id', job.id)
      return new Response(JSON.stringify({ error: 'Empty' }), { status: 500 })
    }

    const pdfBytes = await generateSimplePdf('Playbook: ' + lecture.title, content)
    const path = `${lecture.event_id}/${lecture.id}/playbook.pdf`
    await supabase.storage.from('materials').upload(path, pdfBytes, { contentType: 'application/pdf', upsert: true })
    await supabase.from('lectures').update({ playbook_url: path, processing_progress: 90 }).eq('id', lecture.id)
    await supabase.from('processing_jobs').update({ status: 'completed' }).eq('id', job.id)

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})

async function generateSimplePdf(title: string, content: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const W = 595; const H = 842; const M = 50; const LH = 16

  const cover = doc.addPage([W, H])
  cover.drawRectangle({ x: 0, y: H - 150, width: W, height: 150, color: rgb(0.102, 0.102, 0.18) })
  cover.drawText(title, { x: M, y: H - 90, size: 20, font: bold, color: rgb(1, 1, 1) })

  let page = doc.addPage([W, H]); let y = H - M
  for (const para of content.split('\n\n').filter(Boolean)) {
    const words = para.trim().split(/\s+/); let line = ''
    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      if (font.widthOfTextAtSize(test, 11) > W - 2 * M && line) {
        if (y < M + LH) { page = doc.addPage([W, H]); y = H - M }
        page.drawText(line, { x: M, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) }); y -= LH; line = w
      } else { line = test }
    }
    if (line) {
      if (y < M + LH) { page = doc.addPage([W, H]); y = H - M }
      page.drawText(line, { x: M, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) }); y -= LH
    }
    y -= 8
  }
  return doc.save()
}

async function callAI(prompt: string): Promise<string> {
  const provider = Deno.env.get('AI_PROVIDER') || 'gemini'
  const key = provider === 'gemini' ? Deno.env.get('GEMINI_API_KEY') : Deno.env.get('ANTHROPIC_API_KEY')
  if (!key) throw new Error(`Missing key for ${provider}`)
  if (provider === 'gemini') {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 8192 } }),
    })
    const d = await r.json(); return d.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: Deno.env.get('CLAUDE_MODEL') || 'claude-sonnet-4-6', max_tokens: 8192, messages: [{ role: 'user', content: prompt }] }),
  })
  const d = await r.json(); return d.content?.[0]?.text ?? ''
}
