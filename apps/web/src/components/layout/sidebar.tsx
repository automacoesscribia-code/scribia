'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid,
  List,
  Users,
  UserCircle,
  UserPlus,
  FileText,
  BarChart3,
  Settings,
  Shield,
} from 'lucide-react'
import { UserMenu } from './user-menu'

const NAV_SECTIONS = [
  {
    label: 'Principal',
    items: [
      { href: '/dashboard', icon: LayoutGrid, label: 'Dashboard' },
      { href: '/dashboard/events', icon: List, label: 'Eventos' },
      { href: '/dashboard/lectures', icon: Users, label: 'Palestras' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { href: '/dashboard/speakers', icon: UserCircle, label: 'Palestrantes' },
      { href: '/dashboard/participants', icon: UserPlus, label: 'Participantes' },
      { href: '/dashboard/materials', icon: FileText, label: 'Materiais' },
      { href: '/dashboard/reports', icon: BarChart3, label: 'Relatórios' },
    ],
  },
]

const ADMIN_SECTION = {
  label: 'Administração',
  items: [
    { href: '/dashboard/settings/prompts', icon: Settings, label: 'Prompts IA' },
    { href: '/admin', icon: Shield, label: 'Painel Admin' },
  ],
}

interface SidebarProps {
  userName?: string
  userRole?: string
  isSuperAdmin?: boolean
}

export function Sidebar({ userName = 'Organizador', userRole = 'Organizador', isSuperAdmin = false }: SidebarProps) {
  const pathname = usePathname()
  const isAdmin = userRole === 'Administrador' || isSuperAdmin

  const sections = isAdmin
    ? [...NAV_SECTIONS, ADMIN_SECTION]
    : NAV_SECTIONS

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[220px] bg-bg2 border-r border-border-subtle flex flex-col z-20">
      {/* Logo */}
      <div className="px-5 pt-7 pb-6 border-b border-border-subtle">
        <div className="font-heading font-extrabold text-[22px] text-purple-light tracking-tight leading-none">
          SCRIBIA
        </div>
        <span className="text-text3 text-[10px] mt-0.5 block">
          {isAdmin ? 'Painel Admin' : 'Painel do Organizador'}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 flex flex-col gap-0.5 overflow-y-auto">
        {sections.map((section) => (
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
      </nav>

      {/* User menu */}
      <div className="px-1.5 py-2 border-t border-border-subtle">
        <UserMenu userName={userName} userRole={userRole} />
      </div>
    </aside>
  )
}
