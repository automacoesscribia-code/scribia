'use client'

import Link from 'next/link'
import { UserPlus, Users, FileText, BarChart3 } from 'lucide-react'

interface QuickActionsProps {
  eventId: string
}

const actions = [
  {
    icon: UserPlus,
    label: 'Add Palestrante',
    sub: 'Convidar por e-mail',
    href: '/dashboard/speakers',
  },
  {
    icon: Users,
    label: 'Add Participante',
    sub: 'Convidar por e-mail',
    href: null, // opens within event
  },
  {
    icon: FileText,
    label: 'Gerar relatório',
    sub: 'Exportar PDF',
    href: null,
  },
  {
    icon: BarChart3,
    label: 'Analytics',
    sub: 'Ver engajamento',
    href: null,
  },
]

export function QuickActions({ eventId }: QuickActionsProps) {
  return (
    <div className="bg-bg2 border border-border-subtle rounded-[14px] overflow-hidden animate-fade-up">
      <div className="px-5 py-4 border-b border-border-subtle">
        <h3 className="font-heading text-sm font-bold text-text">
          Ações rápidas
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-2.5 p-4">
        {actions.map((action) => {
          const content = (
            <div className="bg-bg3 border border-border-subtle rounded-xl p-3.5 cursor-pointer transition-all hover:border-border-purple hover:bg-purple-dim flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-dim border border-border-purple flex items-center justify-center shrink-0">
                <action.icon className="w-4 h-4 text-purple-light" />
              </div>
              <div>
                <div className="text-[12.5px] font-medium text-text">
                  {action.label}
                </div>
                <div className="text-[10.5px] text-text3 mt-0.5">
                  {action.sub}
                </div>
              </div>
            </div>
          )

          if (action.href) {
            return (
              <Link key={action.label} href={action.href}>
                {content}
              </Link>
            )
          }

          return (
            <Link key={action.label} href={`/dashboard/events/${eventId}`}>
              {content}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
