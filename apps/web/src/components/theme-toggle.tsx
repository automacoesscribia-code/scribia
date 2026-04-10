'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from './theme-provider'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const next = theme === 'light' ? 'dark' : 'light'
  const Icon = theme === 'light' ? Sun : Moon
  const label = theme === 'light' ? 'Claro' : 'Escuro'

  return (
    <button
      onClick={() => setTheme(next)}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-text2 hover:bg-bg3 transition-colors cursor-pointer rounded-lg"
      title={`Tema: ${label}`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )
}
