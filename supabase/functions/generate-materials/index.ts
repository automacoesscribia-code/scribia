// Generate downloadable materials (PDF/DOCX) for a lecture
// Uses the shared pdf-generator for real PDF output with UTF-8 support

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generatePdfFromMarkdown } from '../_shared/pdf-generator.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { lecture_id, formats = ['pdf'] } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Fetch lecture with related data
    const { data: lecture, error: lectureError } = await supabase
      .from('lectures')
      .select('*, speakers(name), events(name, start_date, end_date)')
      .eq('id', lecture_id)
      .single()

    if (lectureError || !lecture) {
      return new Response(JSON.stringify({ error: 'Lecture not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const eventId = lecture.event_id
    const title = lecture.title
    const speaker = lecture.speakers?.name ?? 'Palestrante'
    const eventName = lecture.events?.name ?? 'Evento'
    const ebookContent = lecture.ebook_content ?? ''
    const playbookContent = lecture.playbook_content ?? ''

    if (!ebookContent && !playbookContent) {
      return new Response(JSON.stringify({ error: 'No content available. Run process-lecture first.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results: Record<string, string> = {}

    // Generate E-book PDF
    if (formats.includes('pdf') && ebookContent) {
      const pdfBytes = await generatePdfFromMarkdown(ebookContent, {
        title,
        subtitle: `por ${speaker}`,
        event: eventName,
        type: 'ebook',
      })

      const storagePath = `${eventId}/${lecture_id}/ebook.pdf`
      const { error: uploadError } = await supabase.storage
        .from('materials')
        .upload(storagePath, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        })

      if (!uploadError) {
        results.ebook_pdf = storagePath
      }
    }

    // Generate Playbook PDF
    if (formats.includes('pdf') && playbookContent) {
      const pdfBytes = await generatePdfFromMarkdown(playbookContent, {
        title: `Playbook: ${title}`,
        subtitle: `por ${speaker}`,
        event: eventName,
        type: 'playbook',
      })

      const storagePath = `${eventId}/${lecture_id}/playbook.pdf`
      const { error: uploadError } = await supabase.storage
        .from('materials')
        .upload(storagePath, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        })

      if (!uploadError) {
        results.playbook_pdf = storagePath
      }
    }

    // Update lecture with material URLs
    const updates: Record<string, string | null> = {}
    if (results.ebook_pdf) updates.ebook_url = results.ebook_pdf
    if (results.playbook_pdf) updates.playbook_url = results.playbook_pdf

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('lectures')
        .update(updates)
        .eq('id', lecture_id)
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Generate materials error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
