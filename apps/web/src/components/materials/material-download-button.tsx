'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { BookOpen, FileText, Loader2, Download } from 'lucide-react'

interface Props {
  storagePath: string
  label: string
  icon: 'book' | 'file'
}

export function MaterialDownloadButton({ storagePath, label, icon }: Props) {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const Icon = icon === 'book' ? BookOpen : FileText

  async function handleClick() {
    setLoading(true)
    try {
      if (storagePath.startsWith('http')) {
        window.open(storagePath, '_blank')
        setLoading(false)
        return
      }

      const { data, error } = await supabase.storage
        .from('materials')
        .createSignedUrl(storagePath, 3600)

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank')
      }
    } catch {
      // ignore
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 bg-bg3 border border-border-subtle rounded-lg px-3 py-2 text-[11px] text-text2 hover:border-border-purple hover:text-purple-light transition-all cursor-pointer disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
      {label}
    </button>
  )
}
