'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, ChevronUp } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

interface UserMenuProps {
  userName: string
  userRole: string
  variant?: 'sidebar' | 'navbar'
}

export function UserMenu({ userName, userRole, variant = 'sidebar' }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }, [router])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', onClickOutside)
    }
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('keydown', onKeyDown)
    }
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  if (variant === 'navbar') {
    return (
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2.5 cursor-pointer rounded-lg px-2 py-1.5 transition-colors hover:bg-bg3"
        >
          <div className="w-8 h-8 rounded-full bg-purple-dim border border-border-purple flex items-center justify-center text-[11px] font-heading font-bold text-purple-light">
            {initials}
          </div>
          <span className="text-[13px] text-text2">{userName}</span>
          <ChevronUp
            className={`w-3.5 h-3.5 text-text3 transition-transform duration-200 ${open ? '' : 'rotate-180'}`}
          />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1.5 w-48 bg-bg3 border border-border-subtle rounded-lg shadow-xl shadow-black/30 overflow-hidden z-50 animate-fade-up">
            <div className="px-3 py-2.5 border-b border-border-subtle">
              <div className="text-[12.5px] font-medium text-text truncate">{userName}</div>
              <div className="text-[10px] text-text3">{userRole}</div>
            </div>
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-scribia-red hover:bg-bg4 transition-colors cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              {isSigningOut ? 'Saindo...' : 'Sair'}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-3 cursor-pointer rounded-lg transition-colors hover:bg-bg3"
      >
        <div className="w-8 h-8 rounded-full bg-purple-dim border border-border-purple flex items-center justify-center text-xs font-heading font-bold text-purple-light shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[12.5px] font-medium text-text truncate">{userName}</div>
          <div className="text-[10px] text-text3">{userRole}</div>
        </div>
        <ChevronUp
          className={`w-3.5 h-3.5 text-text3 shrink-0 transition-transform duration-200 ${open ? '' : 'rotate-180'}`}
        />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1.5 bg-bg3 border border-border-subtle rounded-lg shadow-xl shadow-black/30 overflow-hidden z-50 animate-fade-up">
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-scribia-red hover:bg-bg4 transition-colors cursor-pointer disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            {isSigningOut ? 'Saindo...' : 'Sair'}
          </button>
        </div>
      )}
    </div>
  )
}
