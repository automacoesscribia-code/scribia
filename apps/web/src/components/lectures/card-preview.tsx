'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { Image, Download, RefreshCw, Loader2, Pencil } from 'lucide-react'

interface CardPreviewProps {
  lectureId: string
  lectureTitle: string
  speakerName: string
  cardImageUrl: string | null
}

export function CardPreview({ lectureId, lectureTitle, speakerName, cardImageUrl }: CardPreviewProps) {
  const [loading, setLoading] = useState(false)
  const [customText, setCustomText] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [imageUrl, setImageUrl] = useState(cardImageUrl)
  const supabase = createClient()
  const router = useRouter()

  async function generateCard() {
    setLoading(true)
    try {
      await supabase
        .from('processing_jobs')
        .insert({
          lecture_id: lectureId,
          type: 'card',
          status: 'queued',
          metadata: customText ? { custom_text: customText } : null,
        } as never)

      // Poll for completion
      setTimeout(() => {
        setLoading(false)
        router.refresh()
      }, 3000)
    } catch {
      setLoading(false)
    }
  }

  async function downloadCard() {
    if (!imageUrl) return
    const { data } = await supabase.storage
      .from('materials')
      .createSignedUrl(imageUrl, 3600, { download: true })
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  return (
    <div className="bg-bg2 border border-border-subtle rounded-[14px] overflow-hidden animate-fade-up">
      <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image className="w-4 h-4 text-purple-light" />
          <h3 className="font-heading text-sm font-bold text-text">Card de Divulgação</h3>
        </div>
        <div className="flex gap-2">
          {imageUrl && (
            <button
              onClick={downloadCard}
              className="w-7 h-7 rounded-md bg-bg3 border border-border-subtle flex items-center justify-center text-text2 hover:border-border-purple hover:text-purple-light transition-all"
            >
              <Download className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => setShowEditor(!showEditor)}
            className="w-7 h-7 rounded-md bg-bg3 border border-border-subtle flex items-center justify-center text-text2 hover:border-border-purple hover:text-purple-light transition-all"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Card preview */}
      <div className="p-5">
        {imageUrl ? (
          <div className="rounded-lg overflow-hidden border border-border-subtle">
            <div className="bg-gradient-to-br from-[#1a1230] to-[#2a1a4a] p-6 text-center">
              <div className="font-heading text-lg font-bold text-text mb-1">{lectureTitle}</div>
              <div className="text-[12px] text-text2">{speakerName}</div>
              <div className="text-[10px] text-purple-light mt-3 font-heading font-bold">SCRIBIA</div>
            </div>
          </div>
        ) : (
          <div className="bg-bg3 rounded-lg p-8 text-center border border-border-subtle border-dashed">
            <Image className="w-8 h-8 text-text3 mx-auto mb-2" />
            <p className="text-[12px] text-text3">Nenhum card gerado ainda</p>
          </div>
        )}

        {/* Custom text editor */}
        {showEditor && (
          <div className="mt-3">
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Texto customizado para o card (opcional)"
              className="w-full bg-bg3 border border-border-subtle rounded-lg px-3 py-2 text-[12px] text-text placeholder:text-text3 outline-none focus:border-border-purple resize-none"
              rows={2}
            />
          </div>
        )}

        <button
          onClick={generateCard}
          disabled={loading}
          className="w-full mt-3 inline-flex items-center justify-center gap-2 py-2 rounded-lg text-[12px] font-medium bg-purple text-white hover:bg-purple-light glow-purple disabled:opacity-50 transition-all"
        >
          {loading ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...</>
          ) : imageUrl ? (
            <><RefreshCw className="w-3.5 h-3.5" /> Regenerar</>
          ) : (
            <><Image className="w-3.5 h-3.5" /> Gerar Card</>
          )}
        </button>
      </div>
    </div>
  )
}
