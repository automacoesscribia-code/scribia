'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid,
  Users,
  Calendar,
  Mail,
  Shield,
  Settings,
  Cpu,
} from 'lucide-react'
import { UserMenu } from './user-menu'

const NAV_SECTIONS = [
  {
    label: 'Administração',
    items: [
      { href: '/admin', icon: LayoutGrid, label: 'Visão Geral' },
      { href: '/admin/organizers', icon: Users, label: 'Organizadores' },
      { href: '/admin/events', icon: Calendar, label: 'Todos os Eventos' },
      { href: '/admin/invitations', icon: Mail, label: 'Convites' },
    ],
  },
  {
    label: 'Configurações',
    items: [
      { href: '/admin/ai-settings', icon: Cpu, label: 'Provedor IA' },
      { href: '/admin/prompts', icon: Settings, label: 'Prompts IA' },
    ],
  },
]

interface AdminSidebarProps {
  userName?: string
}

export function AdminSidebar({ userName = 'Admin' }: AdminSidebarProps) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[220px] bg-bg2 border-r border-border-subtle flex flex-col z-20">
      {/* Logo */}
      <div className="px-5 pt-7 pb-6 border-b border-border-subtle">
        <div className="font-heading font-extrabold text-[22px] text-purple-light tracking-tight leading-none">
          SCRIBIA
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <Shield className="w-3 h-3 text-scribia-yellow" />
          <span className="text-scribia-yellow text-[10px] font-medium">
            Super Admin
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 flex flex-col gap-0.5 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="text-[10px] text-text3 uppercase tracking-[1.2px] px-3 pt-4 pb-1.5">
              {section.label}
            </div>
            {section.items.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13.5px] transition-all ${
                    active
                      ? 'bg-purple-dim text-purple-light border border-border-purple'
                      : 'text-text2 hover:bg-bg3 hover:text-text border border-transparent'
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0 opacity-80" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}

        {/* Quick access to organizer dashboard */}
        <div>
          <div className="text-[10px] text-text3 uppercase tracking-[1.2px] px-3 pt-6 pb-1.5">
            Acesso Rápido
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13.5px] text-text2 hover:bg-bg3 hover:text-text border border-transparent transition-all"
          >
            <LayoutGrid className="w-4 h-4 shrink-0 opacity-80" />
            Dashboard Organizador
          </Link>
        </div>
      </nav>

      {/* User menu */}
      <div className="px-1.5 py-2 border-t border-border-subtle">
        <UserMenu userName={userName} userRole="Administrador" />
      </div>
    </aside>
  )
}
