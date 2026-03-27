// Story 3.3: Playbook Generation
// Practical guide with checklists, action items, key takeaways — PDF with UTF-8 support

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
      .select('*, lectures(id, event_id, title, transcript_text, topics, speakers:speaker_id(name))')
      .eq('type', 'playbook')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!job) return new Response(JSON.stringify({ message: 'No pending jobs' }), { status: 200 })

    const lecture = (job as any).lectures
    const speakerName = lecture.speakers?.name ?? 'Palestrante'
    await supabase.from('processing_jobs').update({ status: 'processing' }).eq('id', job.id)

    const prompt = `Gere um playbook pratico e acionavel a partir desta palestra.

Titulo: ${lecture.title}
Palestrante: ${speakerName}
Topicos: ${(lecture.topics ?? []).join(', ')}

Estruture em Markdown com:
- # Playbook: [titulo]
- ## Objetivo: o que o leitor vai aprender (1 paragrafo)
- ## Key Takeaways: 5-7 pontos principais (lista numerada)
- ## Para cada topico principal, crie uma secao com:
  - ### Titulo do topico
  - Resumo do que foi abordado (1-2 paragrafos)
  - Checklist de acoes praticas usando - [ ] para cada item
  - Dicas e insights usando > blockquote
- ## Plano de Acao: proximos passos concretos (lista numerada)
- ## Metricas de Sucesso: como medir o progresso (lista)

Regras:
- NAO use emojis (o PDF nao suporta)
- Tom: direto, pratico, actionable
- Portugues brasileiro
- Use formatacao Markdown pura (headings, bold, listas, blockquotes, checklists)
- NAO invente informacoes que nao estejam na transcricao

TRANSCRICAO:
${(lecture.transcript_text ?? '').slice(0, 80000)}`

    const content = await callAIProvider(prompt, { temperature: 0.7, maxTokens: 8192 })
    if (!content) {
      await supabase.from('processing_jobs').update({ status: 'failed', error_message: 'Empty AI response' }).eq('id', job.id)
      return new Response(JSON.stringify({ error: 'Empty' }), { status: 500 })
    }

    // Save markdown version
    const mdPath = `${lecture.event_id}/${lecture.id}/playbook.md`
    await supabase.storage.from('materials').upload(mdPath, new TextEncoder().encode(content), {
      contentType: 'text/markdown; charset=utf-8',
      upsert: true,
    })

    // Generate PDF with UTF-8 support
    const pdfBytes = await generatePdfFromMarkdown(content, {
      title: `Playbook: ${lecture.title}`,
      subtitle: `por ${speakerName}`,
      type: 'playbook',
    })

    const pdfPath = `${lecture.event_id}/${lecture.id}/playbook.pdf`
    await supabase.storage.from('materials').upload(pdfPath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    })

    await supabase.from('lectures').update({
      playbook_url: pdfPath,
      playbook_content: content,
      processing_progress: 90,
    }).eq('id', lecture.id)

    await supabase.from('processing_jobs').update({ status: 'completed' }).eq('id', job.id)

    return new Response(JSON.stringify({ success: true, pdf_size: pdfBytes.length }), { status: 200 })
  } catch (e) {
    console.error('Playbook generation error:', e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})

