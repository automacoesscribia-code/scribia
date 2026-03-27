// Story 3.3: E-book Generation
// AI Provider generates Markdown content, pdf-generator converts to PDF with UTF-8 support

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generatePdfFromMarkdown } from '../_shared/pdf-generator.ts'
import { callAIProvider } from '../_shared/ai-provider.ts'

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
    const prompt = `Voce e um editor profissional de e-books educacionais. Gere um e-book em Markdown a partir desta palestra.

Titulo: ${lecture.title}
Palestrante: ${speakerName}
Resumo: ${lecture.summary ?? 'N/A'}
Topicos: ${(lecture.topics ?? []).join(', ')}

Estruture com:
- # Titulo do E-book (h1)
- ## Introducao: contexto e importancia do tema (2-3 paragrafos)
- ## Capitulos: um por topico (3-6 capitulos), expandindo o conteudo da transcricao
  - Use ### para subtitulos dentro de cada capitulo
  - Use > blockquote para citacoes diretas do palestrante
  - Use listas (- ou 1.) para enumerar pontos
  - Use **negrito** para termos e conceitos importantes
- ## Conclusao: sintese e proximos passos

Regras importantes:
- NAO use emojis (o PDF nao suporta)
- NAO invente dados, estatisticas ou citacoes que nao estejam na transcricao
- Tom: profissional, acessivel, portugues brasileiro
- Tamanho: 3000-5000 palavras
- Use formatacao Markdown pura (headings, bold, listas, blockquotes)

TRANSCRICAO:
${(lecture.transcript_text ?? '').slice(0, 80000)}

Responda com o texto do e-book diretamente em Markdown.`

    const content = await callAIProvider(prompt, { temperature: 0.7, maxTokens: 8192 })
    if (!content) {
      await supabase.from('processing_jobs').update({ status: 'failed', error_message: 'AI generation empty' }).eq('id', job.id)
      return new Response(JSON.stringify({ error: 'Empty content' }), { status: 500 })
    }

    // Save markdown version
    const mdPath = `${lecture.event_id}/${lecture.id}/ebook.md`
    await supabase.storage.from('materials').upload(mdPath, new TextEncoder().encode(content), {
      contentType: 'text/markdown; charset=utf-8',
      upsert: true,
    })

    // Generate PDF with UTF-8 support, cover, chapters, and formatting
    const pdfBytes = await generatePdfFromMarkdown(content, {
      title: lecture.title,
      subtitle: `por ${speakerName}`,
      type: 'ebook',
    })

    // Upload PDF
    const pdfPath = `${lecture.event_id}/${lecture.id}/ebook.pdf`
    await supabase.storage.from('materials').upload(pdfPath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    })

    // Update lecture
    await supabase
      .from('lectures')
      .update({
        ebook_url: pdfPath,
        ebook_content: content,
        processing_progress: 75,
      })
      .eq('id', lecture.id)

    await supabase.from('processing_jobs').update({ status: 'completed' }).eq('id', job.id)

    return new Response(JSON.stringify({ success: true, pdf_size: pdfBytes.length }), { status: 200 })
  } catch (e) {
    console.error('Ebook generation error:', e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})

