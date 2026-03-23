// Story 3.3: E-book Generation
// AI Provider generates Markdown content, pdf-lib converts to PDF

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
      .select('*, lectures(id, event_id, title, transcript_text, summary, topics, speakers:speaker_id(name))')
      .eq('type', 'ebook')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!job) return new Response(JSON.stringify({ message: 'No pending jobs' }), { status: 200 })

    const lecture = (job as any).lectures
    await supabase.from('processing_jobs').update({ status: 'processing' }).eq('id', job.id)

    // Generate e-book content via AI
    const speakerName = lecture.speakers?.name ?? 'Palestrante'
    const prompt = `Gere um e-book em formato texto estruturado a partir desta palestra.

Título: ${lecture.title}
Palestrante: ${speakerName}
Resumo: ${lecture.summary ?? 'N/A'}
Tópicos: ${(lecture.topics ?? []).join(', ')}

Estruture com:
- Introdução: contexto e importância do tema
- Capítulos: um por tópico, expandindo o conteúdo
- Conclusão: síntese e próximos passos

Tom: profissional, acessível, português brasileiro. Tamanho: 3000-5000 palavras.

TRANSCRIÇÃO:
${(lecture.transcript_text ?? '').slice(0, 80000)}

Responda com o texto do e-book diretamente, sem markdown code blocks.`

    const content = await callAIProvider(prompt)
    if (!content) {
      await supabase.from('processing_jobs').update({ status: 'failed', error_message: 'AI generation empty' }).eq('id', job.id)
      return new Response(JSON.stringify({ error: 'Empty content' }), { status: 500 })
    }

    // Generate PDF via pdf-lib
    const pdfBytes = await generatePdf(lecture.title, speakerName, content)

    // Upload to Storage
    const storagePath = `${lecture.event_id}/${lecture.id}/ebook.pdf`
    await supabase.storage.from('materials').upload(storagePath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    })

    // Update lecture
    await supabase
      .from('lectures')
      .update({ ebook_url: storagePath, processing_progress: 75 })
      .eq('id', lecture.id)

    await supabase.from('processing_jobs').update({ status: 'completed' }).eq('id', job.id)

    return new Response(JSON.stringify({ success: true, pdf_size: pdfBytes.length }), { status: 200 })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})

async function generatePdf(title: string, speaker: string, content: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)

  const PAGE_W = 595
  const PAGE_H = 842
  const MARGIN = 50
  const LINE_H = 16

  // Cover page
  const cover = doc.addPage([PAGE_W, PAGE_H])
  cover.drawRectangle({ x: 0, y: PAGE_H - 200, width: PAGE_W, height: 200, color: rgb(0.102, 0.102, 0.18) })
  cover.drawText('ScribIA', { x: MARGIN, y: PAGE_H - 70, size: 24, font: boldFont, color: rgb(1, 1, 1) })
  cover.drawText(title, { x: MARGIN, y: PAGE_H - 130, size: 22, font: boldFont, color: rgb(1, 1, 1) })
  cover.drawText(speaker, { x: MARGIN, y: PAGE_H - 160, size: 14, font, color: rgb(0.8, 0.8, 0.85) })

  // Content pages
  const paragraphs = content.split('\n\n').filter(Boolean)
  let page = doc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/)
    let line = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(test, 11) > PAGE_W - 2 * MARGIN && line) {
        if (y < MARGIN + LINE_H) { page = doc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN }
        page.drawText(line, { x: MARGIN, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) })
        y -= LINE_H
        line = word
      } else {
        line = test
      }
    }
    if (line) {
      if (y < MARGIN + LINE_H) { page = doc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN }
      page.drawText(line, { x: MARGIN, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) })
      y -= LINE_H
    }
    y -= 8 // paragraph spacing
  }

  return doc.save()
}

async function callAIProvider(prompt: string): Promise<string> {
  const provider = Deno.env.get('AI_PROVIDER') || 'gemini'
  const apiKey = provider === 'gemini'
    ? Deno.env.get('GEMINI_API_KEY')
    : Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error(`Missing API key for ${provider}`)

  if (provider === 'gemini') {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
        }),
      },
    )
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  }

  // Claude fallback
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: Deno.env.get('CLAUDE_MODEL') || 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}
