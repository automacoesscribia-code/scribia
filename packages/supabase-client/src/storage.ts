import type { SupabaseClient } from '@supabase/supabase-js'
import { AUDIO_BUCKET, MATERIALS_BUCKET, getAudioPath, getMaterialPath } from '@scribia/shared'

/**
 * Get a signed URL for streaming audio (1 hour, inline disposition)
 */
export async function getSignedAudioUrl(
  supabase: SupabaseClient,
  eventId: string,
  lectureId: string,
) {
  const path = getAudioPath(eventId, lectureId)
  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(path, 3600, { download: false })

  if (error) throw error
  return data.signedUrl
}

/**
 * Get a signed URL for downloading materials (1 hour)
 */
export async function getSignedMaterialUrl(
  supabase: SupabaseClient,
  eventId: string,
  lectureId: string,
  type: string,
  ext: string = 'pdf',
) {
  const path = getMaterialPath(eventId, lectureId, type, ext)
  const { data, error } = await supabase.storage
    .from(MATERIALS_BUCKET)
    .createSignedUrl(path, 3600, { download: true })

  if (error) throw error
  return data.signedUrl
}
