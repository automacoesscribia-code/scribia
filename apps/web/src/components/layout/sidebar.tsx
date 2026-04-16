'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
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
  Menu,
  X,
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
  const [isOpen, setIsOpen] = useState(false)
  const isAdmin = userRole === 'Administrador' || isSuperAdmin

  const sections = isAdmin
    ? [...NAV_SECTIONS, ADMIN_SECTION]
    : NAV_SECTIONS

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  // Close drawer on route change
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <>
      {/* Mobile topbar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-bg2 border-b border-border-subtle flex items-center justify-between px-4 z-30">
        <div className="font-heading font-extrabold text-[18px] text-purple-light tracking-tight leading-none">
          SCRIBIA
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'}
          className="p-2 rounded-lg text-text2 hover:text-text hover:bg-bg3 transition-colors"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed left-0 top-0 bottom-0 w-[260px] md:w-[220px] bg-bg2 border-r border-border-subtle flex flex-col z-40 transition-transform duration-300 md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="px-5 pt-7 pb-6 border-b border-border-subtle flex items-center justify-between">
          <div>
            <div className="font-heading font-extrabold text-[22px] text-purple-light tracking-tight leading-none">
              SCRIBIA
            </div>
            <span className="text-text3 text-[10px] mt-0.5 block">
              {isAdmin ? 'Painel Admin' : 'Painel do Organizador'}
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Fechar menu"
            className="md:hidden p-1.5 rounded-lg text-text3 hover:text-text hover:bg-bg3 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
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
                    onClick={() => setIsOpen(false)}
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
    </>
  )
}
