import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { lecture_id, formats = ['pdf', 'docx'] } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Fetch lecture data
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
    const summary = lecture.summary ?? ''
    const ebookContent = lecture.ebook_content ?? ''
    const transcript = lecture.transcript ?? ''

    const results: Record<string, string> = {}

    // Generate PDF
    if (formats.includes('pdf')) {
      // Simple PDF generation using pdf-lib patterns
      // In production, this would use ScribiaPdfBuilder from @scribia/shared
      const pdfContent = [
        `%PDF-1.4`,
        `% ScribIA Generated Material`,
        `% Title: ${title}`,
        `% Speaker: ${speaker}`,
        `% Event: ${eventName}`,
      ].join('\n')

      const storagePath = `materials/${eventId}/${lecture_id}/ebook.pdf`
      const { error: uploadError } = await supabase.storage
        .from('materials')
        .upload(storagePath, new TextEncoder().encode(pdfContent), {
          contentType: 'application/pdf',
          upsert: true,
        })

      if (!uploadError) {
        results.pdf = storagePath
      }
    }

    // Generate DOCX
    if (formats.includes('docx')) {
      const storagePath = `materials/${eventId}/${lecture_id}/ebook.docx`
      // In production, uses ScribiaDocxBuilder
      const { error: uploadError } = await supabase.storage
        .from('materials')
        .upload(storagePath, new TextEncoder().encode('DOCX placeholder'), {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: true,
        })

      if (!uploadError) {
        results.docx = storagePath
      }
    }

    // Update lecture with material URLs
    await supabase
      .from('lectures')
      .update({
        pdf_url: results.pdf ?? null,
        docx_url: results.docx ?? null,
      })
      .eq('id', lecture_id)

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
