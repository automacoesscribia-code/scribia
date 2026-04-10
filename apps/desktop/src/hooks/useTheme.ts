import { useState, useEffect } from 'react'

type Theme = 'light' | 'dark'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('scribia-theme')
    return stored === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('scribia-theme', theme)
  }, [theme])

  function setTheme(t: Theme) {
    setThemeState(t)
  }

  function cycleTheme() {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  const label = theme === 'light' ? 'Claro' : 'Escuro'
  const icon = theme === 'light' ? '☀️' : '🌙'

  return { theme, setTheme, cycleTheme, label, icon }
}
