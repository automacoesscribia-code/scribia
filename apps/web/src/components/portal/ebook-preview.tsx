interface EbookPreviewProps {
  content?: string | null
}

export function EbookPreview({ content }: EbookPreviewProps) {
  if (!content) return null

  const truncated = content.slice(0, 300)

  return (
    <div className="bg-bg3 rounded-xl px-6 py-5 mt-5 relative overflow-hidden">
      <div className="flex items-center justify-between mb-3.5">
        <div className="text-[13px] font-semibold text-text2 flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          E-book gerado · Capítulo 1
        </div>
        <span className="text-[12px] text-purple-light cursor-pointer hover:text-purple transition-colors">
          Ler completo →
        </span>
      </div>
      <div className="text-[13.5px] text-text2 leading-7">
        <p>{truncated}...</p>
      </div>
      {/* Fade gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-bg3 to-transparent" />
    </div>
  )
}
