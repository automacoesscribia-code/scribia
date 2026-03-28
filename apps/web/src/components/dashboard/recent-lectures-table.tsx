'use client'

import Link from 'next/link'
import { Chip } from '@/components/ui/chip'
import { Eye, Download } from 'lucide-react'

interface Lecture {
  id: string
  title: string
  status: string
  speakers: { name: string } | null
  ebook_content?: string | null
}

interface RecentLecturesTableProps {
  lectures: Lecture[]
  eventId: string
}

const statusMap: Record<string, { label: string; variant: 'green' | 'yellow' | 'purple' | 'red' | 'default' }> = {
  scheduled: { label: 'Agendada', variant: 'default' },
  recording: { label: 'Gravando', variant: 'red' },
  processing: { label: 'Processando', variant: 'yellow' },
  completed: { label: 'Transcrito', variant: 'green' },
}

function getStatus(lecture: Lecture) {
  if (lecture.ebook_content) return { label: 'E-book Pronto', variant: 'purple' as const }
  return statusMap[lecture.status] ?? statusMap.scheduled
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function RecentLecturesTable({ lectures, eventId }: RecentLecturesTableProps) {
  return (
    <div className="bg-bg2 border border-border-subtle rounded-[14px] overflow-hidden animate-fade-up">
      <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
        <h3 className="font-heading text-sm font-bold text-text">
          Palestras recentes
        </h3>
        <Link
          href={`/dashboard/events/${eventId}`}
          className="text-xs text-purple-light hover:text-purple transition-colors"
        >
          Ver todas →
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-[10.5px] text-text3 uppercase tracking-[0.8px] px-5 py-2.5 text-left border-b border-border-subtle">
                Palestra
              </th>
              <th className="text-[10.5px] text-text3 uppercase tracking-[0.8px] px-5 py-2.5 text-left border-b border-border-subtle">
                Palestrante
              </th>
              <th className="text-[10.5px] text-text3 uppercase tracking-[0.8px] px-5 py-2.5 text-left border-b border-border-subtle">
                Status
              </th>
              <th className="text-[10.5px] text-text3 uppercase tracking-[0.8px] px-5 py-2.5 text-left border-b border-border-subtle">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {lectures.map((lecture) => {
              const { label, variant } = getStatus(lecture)
              const speakerName = lecture.speakers?.name ?? 'Sem palestrante'
              return (
                <tr key={lecture.id} className="transition-colors hover:bg-bg3">
                  <td className="px-5 py-3.5 text-[13px] text-text border-b border-border-subtle">
                    {lecture.title}
                  </td>
                  <td className="px-5 py-3.5 text-[13px] border-b border-border-subtle">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-purple-dim flex items-center justify-center text-[9px] font-heading font-bold text-purple-light shrink-0">
                        {getInitials(speakerName)}
                      </div>
                      <span className="text-text2">{speakerName}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 border-b border-border-subtle">
                    <Chip variant={variant}>{label}</Chip>
                  </td>
                  <td className="px-5 py-3.5 border-b border-border-subtle">
                    <div className="flex gap-2">
                      <Link
                        href={`/dashboard/events/${eventId}`}
                        className="w-7 h-7 rounded-md bg-bg3 border border-border-subtle flex items-center justify-center text-text2 hover:border-border-purple hover:bg-purple-dim hover:text-purple-light transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Link>
                      <button className="w-7 h-7 rounded-md bg-bg3 border border-border-subtle flex items-center justify-center text-text2 hover:border-border-purple hover:bg-purple-dim hover:text-purple-light transition-all">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {lectures.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-[13px] text-text3">
                  Nenhuma palestra cadastrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
