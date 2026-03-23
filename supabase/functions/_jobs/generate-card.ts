// Story 6.1 (pre-built): Card generation
// Uses Satori + resvg-js for PNG generation in Deno

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Note: satori and @resvg/resvg-js will be imported when available for Deno
// For now, generates a placeholder SVG → PNG via basic approach

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: job } = await supabase
      .from('processing_jobs')
      .select('*, lectures(id, event_id, title, summary, speakers:speaker_id(name), events:event_id(name))')
      .eq('type', 'card')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!job) return new Response(JSON.stringify({ message: 'No pending jobs' }), { status: 200 })

    const lecture = (job as any).lectures
    await supabase.from('processing_jobs').update({ status: 'processing' }).eq('id', job.id)

    // Generate card SVG (placeholder until satori is available in Deno)
    const title = lecture.title ?? 'Palestra'
    const speaker = lecture.speakers?.name ?? ''
    const eventName = lecture.events?.name ?? ''
    const snippet = (lecture.summary ?? '').slice(0, 120)

    const svg = generateCardSvg(title, speaker, eventName, snippet, 1200, 630)

    // Store as SVG for now (PNG conversion via satori+resvg when deps available)
    const ogPath = `${lecture.event_id}/${lecture.id}/card_og.svg`
    await supabase.storage.from('materials').upload(ogPath, new TextEncoder().encode(svg), {
      contentType: 'image/svg+xml', upsert: true,
    })

    await supabase.from('lectures').update({
      card_image_url: ogPath,
      processing_progress: 100,
      status: 'completed',
    }).eq('id', lecture.id)

    await supabase.from('processing_jobs').update({ status: 'completed' }).eq('id', job.id)

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})

function generateCardSvg(title: string, speaker: string, event: string, snippet: string, w: number, h: number): string {
  // Truncate title for display
  const displayTitle = title.length > 60 ? title.slice(0, 57) + '...' : title
  const displaySnippet = snippet.length > 100 ? snippet.slice(0, 97) + '...' : snippet

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="100%" style="stop-color:#16213e"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)" rx="0"/>
  <rect x="0" y="${h - 6}" width="${w}" height="6" fill="#e94560"/>
  <text x="60" y="80" fill="#e94560" font-size="20" font-family="sans-serif" font-weight="bold">ScribIA</text>
  <text x="60" y="180" fill="white" font-size="36" font-family="sans-serif" font-weight="bold">${escapeXml(displayTitle)}</text>
  <text x="60" y="240" fill="#aaaacc" font-size="20" font-family="sans-serif">${escapeXml(speaker)}</text>
  <text x="60" y="290" fill="#666688" font-size="16" font-family="sans-serif">${escapeXml(event)}</text>
  <text x="60" y="380" fill="#8888aa" font-size="16" font-family="sans-serif">${escapeXml(displaySnippet)}</text>
</svg>`
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
