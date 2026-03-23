// Story 3.1: Transcription Pipeline (Whisper)
// Edge Function: processes transcription jobs from queue

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WHISPER_MAX_SIZE = 25 * 1024 * 1024 // 25MB
const MAX_RETRIES = 3
const BACKOFF_BASE = 5000 // 5s, 15s, 45s

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Fetch next queued transcription job
    const { data: job, error: jobError } = await supabase
      .from('processing_jobs')
      .select('*, lectures(id, event_id, audio_path)')
      .eq('type', 'transcription')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (jobError || !job) {
      return new Response(JSON.stringify({ message: 'No pending jobs' }), { status: 200 })
    }

    const lecture = (job as any).lectures
    if (!lecture?.audio_path) {
      await markFailed(supabase, job.id, lecture?.id, 'No audio path found')
      return new Response(JSON.stringify({ error: 'No audio path' }), { status: 400 })
    }

    // Mark as processing
    await supabase.from('processing_jobs').update({ status: 'processing' }).eq('id', job.id)
    await updateProgress(supabase, lecture.id, 0)

    // Download audio from Storage
    await updateProgress(supabase, lecture.id, 10)
    const { data: audioData, error: dlError } = await supabase.storage
      .from('audio-files')
      .download(lecture.audio_path)

    if (dlError || !audioData) {
      await markFailed(supabase, job.id, lecture.id, `Download failed: ${dlError?.message}`)
      return new Response(JSON.stringify({ error: 'Download failed' }), { status: 500 })
    }

    // Transcribe with retry
    await updateProgress(supabase, lecture.id, 20)
    let transcript = ''
    let lastError = ''

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        transcript = await callWhisperAPI(audioData)
        break
      } catch (e) {
        lastError = String(e)
        if (attempt < MAX_RETRIES - 1) {
          const delay = BACKOFF_BASE * Math.pow(3, attempt)
          await new Promise((r) => setTimeout(r, delay))
        }
      }
    }

    if (!transcript) {
      await markFailed(supabase, job.id, lecture.id, `Whisper failed after ${MAX_RETRIES} attempts: ${lastError}`)
      return new Response(JSON.stringify({ error: 'Transcription failed' }), { status: 500 })
    }

    // Save transcript
    await supabase
      .from('lectures')
      .update({
        transcript_text: transcript,
        processing_progress: 25,
      })
      .eq('id', lecture.id)

    // Mark job completed
    await supabase
      .from('processing_jobs')
      .update({ status: 'completed', attempt_count: job.attempt_count + 1 })
      .eq('id', job.id)

    // Cascade: create downstream jobs
    const downstreamTypes = ['summary', 'ebook', 'playbook', 'card']
    for (const type of downstreamTypes) {
      await supabase.from('processing_jobs').insert({
        lecture_id: lecture.id,
        type,
        status: 'queued',
      })
    }

    return new Response(
      JSON.stringify({ success: true, lecture_id: lecture.id, transcript_length: transcript.length }),
      { status: 200 },
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})

async function callWhisperAPI(audioBlob: Blob): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY')

  // Check if audio needs splitting
  if (audioBlob.size > WHISPER_MAX_SIZE) {
    // For large files, we'd need to split. For now, truncate to limit.
    // Full implementation would use ffmpeg or Web Audio API to split.
    console.warn(`Audio size ${audioBlob.size} exceeds ${WHISPER_MAX_SIZE}, sending as-is (may fail)`)
  }

  const form = new FormData()
  form.append('file', audioBlob, 'audio.wav')
  form.append('model', 'whisper-1')
  form.append('language', 'pt')
  form.append('response_format', 'text')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Whisper API error ${response.status}: ${body}`)
  }

  return response.text()
}

async function updateProgress(supabase: any, lectureId: string, progress: number) {
  await supabase.from('lectures').update({ processing_progress: progress }).eq('id', lectureId)
}

async function markFailed(supabase: any, jobId: string, lectureId: string | undefined, error: string) {
  await supabase
    .from('processing_jobs')
    .update({ status: 'failed', error_message: error })
    .eq('id', jobId)
  if (lectureId) {
    await supabase.from('lectures').update({ status: 'failed' }).eq('id', lectureId)
  }
}
