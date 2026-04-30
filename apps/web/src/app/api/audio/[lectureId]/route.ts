import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import lamejs from 'lamejs-fixed'

/** Extract numeric index from chunk filename (e.g. "chunk_42.wav" → 42) */
function chunkIndex(name: string): number {
  const match = name.match(/chunk_(\d+)\.wav$/)
  return match ? parseInt(match[1], 10) : 0
}

/** Read WAV header fields from a buffer */
function readWavHeader(buf: ArrayBuffer) {
  const view = new DataView(buf)
  return {
    channels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    bitsPerSample: view.getUint16(34, true),
  }
}

/** Encode PCM Int16 samples to MP3 using lamejs */
function encodeToMp3(samples: Int16Array, sampleRate: number): Uint8Array {
  const encoder = new lamejs.Mp3Encoder(1, sampleRate, 64) // mono, 64kbps (good for speech)
  const blockSize = 1152
  const mp3Parts: Int8Array[] = []

  for (let i = 0; i < samples.length; i += blockSize) {
    const block = samples.subarray(i, Math.min(i + blockSize, samples.length))
    const mp3buf = encoder.encodeBuffer(block)
    if (mp3buf.length > 0) mp3Parts.push(mp3buf)
  }

  const end = encoder.flush()
  if (end.length > 0) mp3Parts.push(end)

  // Concatenate all MP3 parts
  const totalSize = mp3Parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalSize)
  let offset = 0
  for (const part of mp3Parts) {
    result.set(new Uint8Array(part.buffer, part.byteOffset, part.length), offset)
    offset += part.length
  }
  return result
}

/**
 * GET /api/audio/[lectureId]
 *
 * Strategy: merge-once as MP3, serve-forever.
 * 1. Check if merged.mp3 exists in Storage → redirect to signed URL (supports seeking)
 * 2. If not, download all WAV chunks → concatenate → encode MP3 → upload → redirect
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ lectureId: string }> }
) {
  const { lectureId } = await params

  // Verify user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('lectures')
    .select('id, event_id, audio_path')
    .eq('id', lectureId)
    .single()

  const lecture = data as { id: string; event_id: string; audio_path: string | null } | null

  if (!lecture) {
    return NextResponse.json({ error: 'Lecture not found' }, { status: 404 })
  }

  const storagePath = lecture.audio_path ?? `${lecture.event_id}/${lecture.id}`
  const mergedMp3Path = `${storagePath}/merged.mp3`

  // 1. Check if merged.mp3 already exists and is valid (> 1KB)
  const { data: existing } = await adminClient.storage
    .from('audio-files')
    .createSignedUrl(mergedMp3Path, 3600)

  if (existing?.signedUrl) {
    const proxyRes = await fetch(existing.signedUrl)
    if (proxyRes.ok && proxyRes.body) {
      const contentLength = proxyRes.headers.get('content-length')
      const size = contentLength ? parseInt(contentLength, 10) : 0

      // If merged.mp3 is too small (< 1KB), it's corrupt — delete and re-merge
      if (size < 1024) {
        console.warn(`merged.mp3 is only ${size} bytes — deleting corrupt cache`)
        await adminClient.storage.from('audio-files').remove([mergedMp3Path])
      } else {
        const headers: Record<string, string> = {
          'Content-Type': 'audio/mpeg',
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, max-age=3600',
        }
        if (contentLength) headers['Content-Length'] = contentLength
        return new NextResponse(proxyRes.body, { status: 200, headers })
      }
    }
  }

  // 2. Check if a single uploaded file (final.webm) exists — serve directly
  const finalWebmPath = `${storagePath}/final.webm`
  const { data: finalWebmUrl } = await adminClient.storage
    .from('audio-files')
    .createSignedUrl(finalWebmPath, 3600)

  if (finalWebmUrl?.signedUrl) {
    const proxyRes = await fetch(finalWebmUrl.signedUrl)
    if (proxyRes.ok && proxyRes.body) {
      const contentLength = proxyRes.headers.get('content-length')
      const contentType = proxyRes.headers.get('content-type') || 'audio/webm'
      const headers: Record<string, string> = {
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
      }
      if (contentLength) headers['Content-Length'] = contentLength
      return new NextResponse(proxyRes.body, { status: 200, headers })
    }
  }

  // 3. No merged MP3 and no final.webm — build from WAV chunks

  // List ALL chunks with pagination
  const allFiles: { name: string }[] = []
  let listOffset = 0
  const pageSize = 1000

  while (true) {
    const { data: page } = await adminClient.storage
      .from('audio-files')
      .list(storagePath, { limit: pageSize, offset: listOffset })

    if (!page || page.length === 0) break
    allFiles.push(...page)
    if (page.length < pageSize) break
    listOffset += pageSize
  }

  const chunks = allFiles
    .filter((f) => f.name.endsWith('.wav') && !f.name.startsWith('merged'))
    .sort((a, b) => chunkIndex(a.name) - chunkIndex(b.name))

  if (chunks.length === 0) {
    return NextResponse.json({ error: 'No audio chunks found' }, { status: 404 })
  }

  // Download all chunks and concatenate PCM data
  const chunkBuffers: ArrayBuffer[] = []
  let wavSampleRate = 16000
  let wavChannels = 1

  for (let i = 0; i < chunks.length; i++) {
    const chunkPath = `${storagePath}/${chunks[i].name}`
    const { data: blob, error } = await adminClient.storage
      .from('audio-files')
      .download(chunkPath)

    if (error || !blob) {
      console.error(`Failed to download chunk ${chunkPath}:`, error)
      continue
    }

    const buffer = await blob.arrayBuffer()

    if (i === 0) {
      // Read format from first chunk's WAV header
      const header = readWavHeader(buffer)
      wavSampleRate = header.sampleRate
      wavChannels = header.channels
    }

    // Skip 44-byte WAV header, keep PCM data
    chunkBuffers.push(buffer.slice(44))
  }

  if (chunkBuffers.length === 0) {
    return NextResponse.json({ error: 'Failed to process audio' }, { status: 500 })
  }

  // Concatenate all PCM data
  const totalPcmSize = chunkBuffers.reduce((sum, buf) => sum + buf.byteLength, 0)
  const pcmBuffer = new Uint8Array(totalPcmSize)
  let writeOffset = 0
  for (const chunk of chunkBuffers) {
    pcmBuffer.set(new Uint8Array(chunk), writeOffset)
    writeOffset += chunk.byteLength
  }

  // Convert to Int16Array for the MP3 encoder
  let monoSamples: Int16Array

  if (wavChannels === 1) {
    // Already mono
    monoSamples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 2)
  } else {
    // Mix stereo (or multi-channel) to mono
    const allSamples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 2)
    const frameCount = Math.floor(allSamples.length / wavChannels)
    monoSamples = new Int16Array(frameCount)
    for (let f = 0; f < frameCount; f++) {
      let sum = 0
      for (let c = 0; c < wavChannels; c++) {
        sum += allSamples[f * wavChannels + c]
      }
      monoSamples[f] = Math.round(sum / wavChannels)
    }
  }

  // 3. Encode to MP3
  const mp3Data = encodeToMp3(monoSamples, wavSampleRate)

  // 4. Upload merged.mp3 to Storage
  const mp3Bytes = mp3Data.slice().buffer as ArrayBuffer
  const mp3Blob = new Blob([mp3Bytes], { type: 'audio/mpeg' })
  const { error: uploadError } = await adminClient.storage
    .from('audio-files')
    .upload(mergedMp3Path, mp3Blob, {
      contentType: 'audio/mpeg',
      upsert: true,
    })

  if (uploadError) {
    console.error('Failed to upload merged.mp3:', uploadError)
    // Serve directly as fallback
    return new NextResponse(mp3Bytes, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(mp3Data.byteLength),
      },
    })
  }

  // 5. Proxy from signed URL (avoids CORS issues with <audio> elements)
  const { data: newSigned } = await adminClient.storage
    .from('audio-files')
    .createSignedUrl(mergedMp3Path, 3600)

  if (newSigned?.signedUrl) {
    const proxyRes = await fetch(newSigned.signedUrl)
    if (proxyRes.ok && proxyRes.body) {
      return new NextResponse(proxyRes.body, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(mp3Data.byteLength),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, max-age=3600',
        },
      })
    }
  }

  // Fallback: serve directly from memory
  return new NextResponse(mp3Bytes, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(mp3Data.byteLength),
    },
  })
}
