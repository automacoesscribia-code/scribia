'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { FileText, Download, Loader2 } from 'lucide-react'

interface MaterialsDownloadProps {
  lectureId: string
  pdfUrl: string | null
  docxUrl: string | null
}

export function MaterialsDownload({ lectureId, pdfUrl, docxUrl }: MaterialsDownloadProps) {
  const [generating, setGenerating] = useState(false)
  const [selectedFormats, setSelectedFormats] = useState<string[]>(['pdf', 'docx'])
  const supabase = createClient()
  const router = useRouter()

  async function generateMaterials() {
    setGenerating(true)
    try {
      await supabase.functions.invoke('generate-materials', {
        body: { lecture_id: lectureId, formats: selectedFormats },
      })
      router.refresh()
    } catch {
      // ignore
    }
    setGenerating(false)
  }

  async function download(path: string) {
    const { data } = await supabase.storage
      .from('materials')
      .createSignedUrl(path, 3600, { download: true })
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')

    // Track download
    await supabase.rpc('increment_download_count' as never, { p_lecture_id: lectureId } as never)
  }

  function toggleFormat(format: string) {
    setSelectedFormats((prev) =>
      prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format],
    )
  }

  const hasMaterials = pdfUrl || docxUrl

  return (
    <div className="bg-bg2 border border-border-subtle rounded-[14px] overflow-hidden animate-fade-up">
      <div className="px-5 py-4 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-purple-light" />
          <h3 className="font-heading text-sm font-bold text-text">Materiais</h3>
        </div>
      </div>

      <div className="p-5">
        {hasMaterials ? (
          <div className="flex flex-col gap-2">
            {pdfUrl && (
              <button
                onClick={() => download(pdfUrl)}
                className="flex items-center gap-3 bg-bg3 border border-border-subtle rounded-lg p-3 hover:border-border-purple transition-all text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-scribia-red/10 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-scribia-red" />
                </div>
                <div className="flex-1">
                  <div className="text-[12.5px] font-medium text-text">E-book PDF</div>
                  <div className="text-[10.5px] text-text3">Versão formatada para leitura</div>
                </div>
                <Download className="w-4 h-4 text-text3" />
              </button>
            )}
            {docxUrl && (
              <button
                onClick={() => download(docxUrl)}
                className="flex items-center gap-3 bg-bg3 border border-border-subtle rounded-lg p-3 hover:border-border-purple transition-all text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-dim flex items-center justify-center">
                  <FileText className="w-4 h-4 text-purple-light" />
                </div>
                <div className="flex-1">
                  <div className="text-[12.5px] font-medium text-text">E-book DOCX</div>
                  <div className="text-[10.5px] text-text3">Versão editável (Word)</div>
                </div>
                <Download className="w-4 h-4 text-text3" />
              </button>
            )}
          </div>
        ) : (
          <div>
            <div className="flex gap-3 mb-3">
              {['pdf', 'docx'].map((fmt) => (
                <label
                  key={fmt}
                  className={`flex-1 flex items-center justify-center py-2 rounded-lg border cursor-pointer transition-all text-[12px] ${
                    selectedFormats.includes(fmt)
                      ? 'bg-purple-dim border-border-purple text-purple-light'
                      : 'bg-bg3 border-border-subtle text-text2 hover:border-border-purple'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFormats.includes(fmt)}
                    onChange={() => toggleFormat(fmt)}
                    className="sr-only"
                  />
                  {fmt.toUpperCase()}
                </label>
              ))}
            </div>
            <button
              onClick={generateMaterials}
              disabled={generating || selectedFormats.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-lg text-[12px] font-medium bg-purple text-white hover:bg-purple-light glow-purple disabled:opacity-50 transition-all"
            >
              {generating ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...</>
              ) : (
                <><FileText className="w-3.5 h-3.5" /> Gerar Materiais</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
