'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Search } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'active', label: 'Ativo' },
  { value: 'completed', label: 'Concluído' },
  { value: 'archived', label: 'Arquivado' },
]

interface EventFiltersProps {
  currentStatus?: string
  currentQuery?: string
}

export function EventFilters({ currentStatus, currentQuery }: EventFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value && value !== 'all') {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, searchParams, pathname],
  )

  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
      <select
        value={currentStatus || 'all'}
        onChange={(e) => updateParams('status', e.target.value)}
        className="bg-bg3 border border-border-subtle rounded-lg px-3 py-2.5 text-[13px] text-text2 outline-none transition-all focus:border-border-purple focus:ring-1 focus:ring-purple/20 appearance-none cursor-pointer w-full sm:w-auto"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text3" />
        <input
          type="text"
          placeholder="Buscar por nome..."
          defaultValue={currentQuery || ''}
          onChange={(e) => {
            const timeout = setTimeout(() => updateParams('q', e.target.value), 300)
            return () => clearTimeout(timeout)
          }}
          className="w-full bg-bg3 border border-border-subtle rounded-lg pl-9 pr-3 py-2.5 text-[13px] text-text placeholder:text-text3 outline-none transition-all focus:border-border-purple focus:ring-1 focus:ring-purple/20"
        />
      </div>
    </div>
  )
}
