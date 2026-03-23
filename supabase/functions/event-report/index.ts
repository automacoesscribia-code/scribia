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
    const { event_id } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Fetch event
    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', event_id)
      .single()

    if (!event) {
      return new Response(JSON.stringify({ error: 'Event not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch lectures
    const { data: lectures } = await supabase
      .from('lectures')
      .select('id, title, status, duration_seconds, speakers(name)')
      .eq('event_id', event_id)

    const lectureList = lectures ?? []
    const lectureIds = lectureList.map((l: any) => l.id)

    // Fetch participant stats
    const { count: totalParticipants } = await supabase
      .from('event_participants')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', event_id)

    // Fetch access data
    let accessData: any[] = []
    if (lectureIds.length > 0) {
      const { data } = await supabase
        .from('lecture_access')
        .select('lecture_id, accessed_at, download_count')
        .in('lecture_id', lectureIds)
      accessData = data ?? []
    }

    // Compute analytics
    const totalLectures = lectureList.length
    const completed = lectureList.filter((l: any) => l.status === 'completed').length
    const totalDownloads = accessData.reduce((sum: number, a: any) => sum + (a.download_count ?? 0), 0)
    const activeUsers = new Set(accessData.filter((a: any) => a.accessed_at).map((a: any) => a.lecture_id)).size
    const engagementRate = (totalParticipants ?? 0) > 0
      ? Math.round((activeUsers / (totalParticipants ?? 1)) * 100)
      : 0

    // Top lectures by access
    const lectureAccessCounts = lectureList.map((l: any) => ({
      title: l.title,
      speaker: l.speakers?.name ?? 'N/A',
      views: accessData.filter((a: any) => a.lecture_id === l.id && a.accessed_at).length,
      downloads: accessData.filter((a: any) => a.lecture_id === l.id).reduce((s: number, a: any) => s + (a.download_count ?? 0), 0),
    })).sort((a: any, b: any) => b.views - a.views)

    // Generate report content (would use AI Provider in production)
    const reportData = {
      event: {
        name: event.name,
        startDate: event.start_date,
        endDate: event.end_date,
        location: event.location,
      },
      metrics: {
        totalLectures,
        completedLectures: completed,
        totalParticipants: totalParticipants ?? 0,
        activeParticipants: activeUsers,
        totalDownloads,
        engagementRate,
      },
      topLectures: lectureAccessCounts.slice(0, 5),
      generatedAt: new Date().toISOString(),
    }

    // Save report as JSON (PDF/DOCX generation would use ScribiaPdfBuilder)
    const reportJson = JSON.stringify(reportData, null, 2)
    const storagePath = `materials/${event_id}/report.json`

    await supabase.storage
      .from('materials')
      .upload(storagePath, new TextEncoder().encode(reportJson), {
        contentType: 'application/json',
        upsert: true,
      })

    return new Response(JSON.stringify({ success: true, report: reportData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
