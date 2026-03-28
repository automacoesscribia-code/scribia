'use client'

import Link from 'next/link'
import type { EventStatus } from '@scribia/shared'
import { Chip } from '@/components/ui/chip'
import { Calendar, MapPin, Mic } from 'lucide-react'

interface EventCardProps {
  id: string
  name: string
  start_date: string
  end_date: string
  status: EventStatus
  location: string | null
  cover_image_url: string | null
  lecture_count: number
}

const statusConfig: Record<EventStatus, { label: string; variant: 'green' | 'yellow' | 'purple' | 'red' }> = {
  draft: { label: 'Rascunho', variant: 'yellow' },
  active: { label: 'Ativo', variant: 'green' },
  completed: { label: 'Concluído', variant: 'purple' },
  archived: { label: 'Arquivado', variant: 'red' },
}

export function EventCard({
  id,
  name,
  start_date,
  end_date,
  status,
  location,
  cover_image_url,
  lecture_count,
}: EventCardProps) {
  const startDate = new Date(start_date).toLocaleDateString('pt-BR')
  const endDate = new Date(end_date).toLocaleDateString('pt-BR')
  const { label, variant } = statusConfig[status]

  return (
    <Link href={`/dashboard/events/${id}`} className="block">
      <div className="bg-bg2 border border-border-subtle rounded-[14px] overflow-hidden transition-all hover:border-border-purple hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(107,78,255,0.12)] animate-fade-up">
        {cover_image_url ? (
          <img src={cover_image_url} alt={name} className="h-24 w-full object-cover" />
        ) : (
          <div className="h-24 w-full bg-gradient-to-br from-[#1a1230] to-[#2a1a4a]" />
        )}
        <div className="p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-heading font-bold text-sm text-text truncate leading-tight">
              {name}
            </h3>
            <Chip variant={variant}>{label}</Chip>
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-text3">
            <Calendar className="w-3 h-3" />
            {startDate} — {endDate}
          </div>
          {location && (
            <div className="flex items-center gap-1.5 text-[12px] text-text3">
              <MapPin className="w-3 h-3" />
              {location}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-[12px] text-text3">
            <Mic className="w-3 h-3" />
            {lecture_count} {lecture_count === 1 ? 'palestra' : 'palestras'}
          </div>
        </div>
      </div>
    </Link>
  )
}
