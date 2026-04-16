'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutGrid,
  Users,
  Calendar,
  Mail,
  Shield,
  Settings,
  Cpu,
  Menu,
  X,
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
  const [isOpen, setIsOpen] = useState(false)

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

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
        <div className="flex items-center gap-2">
          <div className="font-heading font-extrabold text-[18px] text-purple-light tracking-tight leading-none">
            SCRIBIA
          </div>
          <Shield className="w-3 h-3 text-scribia-yellow" />
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
            <div className="flex items-center gap-1.5 mt-1">
              <Shield className="w-3 h-3 text-scribia-yellow" />
              <span className="text-scribia-yellow text-[10px] font-medium">
                Super Admin
              </span>
            </div>
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

          {/* Quick access to organizer dashboard */}
          <div>
            <div className="text-[10px] text-text3 uppercase tracking-[1.2px] px-3 pt-6 pb-1.5">
              Acesso Rápido
            </div>
            <Link
              href="/dashboard"
              onClick={() => setIsOpen(false)}
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
    </>
  )
}
