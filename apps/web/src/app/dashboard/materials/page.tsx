import { createClient } from '@/lib/supabase-server'
import { FileText, BookOpen, Download } from 'lucide-react'
import Link from 'next/link'
import { MaterialDownloadButton } from '@/components/materials/material-download-button'

export default async function MaterialsPage() {
  const supabase = await createClient()

  // Fetch lectures that have at least one material generated
  const { data: lectures } = await supabase
    .from('lectures')
    .select('id, title, event_id, ebook_url, playbook_url, card_image_url, status, processing_progress, events(name), speakers(name)')
    .or('ebook_url.neq.null,playbook_url.neq.null')
    .order('updated_at', { ascending: false })

  const items = (lectures ?? []) as Array<{
    id: string
    title: string
    event_id: string
    ebook_url: string | null
    playbook_url: string | null
    card_image_url: string | null
    status: string
    processing_progress: number
    events: { name: string } | null
    speakers: { name: string } | null
  }>

  // Also fetch lectures in processing (materials being generated)
  const { data: processingLectures } = await supabase
    .from('lectures')
    .select('id, title, event_id, status, processing_progress, events(name)')
    .eq('status', 'processing')
    .is('ebook_url', null)
    .order('updated_at', { ascending: false })

  const processing = (processingLectures ?? []) as Array<{
    id: string
    title: string
    event_id: string
    status: string
    processing_progress: number
    events: { name: string } | null
  }>

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6 md:mb-9">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-text">Materiais</h1>
          <p className="text-[13px] text-text3 mt-0.5">E-books, playbooks e cards gerados</p>
        </div>
      </div>

      {/* Processing */}
      {processing.length > 0 && (
        <div className="mb-8">
          <h2 className="text-[12px] text-text3 uppercase tracking-wider mb-3">Em processamento</h2>
          <div className="space-y-2">
            {processing.map((lecture) => (
              <Link
                key={lecture.id}
                href={`/dashboard/lectures/${lecture.id}`}
                className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 bg-bg2 border border-border-subtle rounded-xl px-4 sm:px-5 py-3.5 sm:py-4 hover:border-border-purple transition-all"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-text font-medium truncate">{lecture.title}</p>
                  <p className="text-[11px] text-text3 truncate">{lecture.events?.name ?? 'Evento'}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-20 sm:w-24 h-1.5 bg-bg3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple rounded-full transition-all"
                      style={{ width: `${lecture.processing_progress}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-purple-light font-mono w-8 text-right">
                    {lecture.processing_progress}%
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Materials list */}
      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((lecture) => (
            <div
              key={lecture.id}
              className="bg-bg2 border border-border-subtle rounded-xl px-4 sm:px-5 py-3.5 sm:py-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/dashboard/lectures/${lecture.id}`}
                    className="text-[14px] text-text font-medium hover:text-purple-light transition-colors break-words"
                  >
                    {lecture.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-text3">{lecture.events?.name ?? 'Evento'}</span>
                    {lecture.speakers?.name && (
                      <>
                        <span className="text-[11px] text-text3">·</span>
                        <span className="text-[11px] text-text3">{lecture.speakers.name}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0 sm:ml-4">
                  {lecture.ebook_url && (
                    <MaterialDownloadButton
                      storagePath={lecture.ebook_url}
                      label="E-book"
                      icon="book"
                    />
                  )}
                  {lecture.playbook_url && (
                    <MaterialDownloadButton
                      storagePath={lecture.playbook_url}
                      label="Playbook"
                      icon="file"
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : processing.length === 0 ? (
        <div className="mt-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-dim border border-border-purple flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7 text-purple-light" />
          </div>
          <p className="text-text2 text-[14px]">Nenhum material gerado ainda</p>
          <p className="text-text3 text-[13px] mt-1">
            Crie palestras e processe o audio para gerar e-books, playbooks e cards automaticamente.
          </p>
        </div>
      ) : null}
    </div>
  )
}
