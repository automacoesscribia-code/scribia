'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User, Mail, Lock } from 'lucide-react'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const role = 'participant' as const // Organizers are invited by super_admin
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.refresh()
  }

  const inputClass =
    'w-full bg-bg3 border border-border-subtle rounded-lg pl-10 pr-3.5 py-3 text-[14px] text-text placeholder:text-text3 outline-none transition-all focus:border-border-purple focus:ring-2 focus:ring-purple/20'
  const labelClass = 'block text-[12px] font-medium text-text2 mb-1.5'

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="w-full max-w-md bg-bg2 border border-border-subtle rounded-2xl p-8 animate-fade-up">
        <div className="text-center mb-8">
          <h1 className="font-heading text-3xl font-extrabold text-purple-light tracking-tight">
            SCRIBIA
          </h1>
          <p className="text-[13px] text-text3 mt-2">
            Preencha os dados para se cadastrar
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label htmlFor="fullName" className={labelClass}>
              Nome completo
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text3" />
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className={inputClass}
                placeholder="Seu nome completo"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text3" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className={labelClass}>
              Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text3" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className={inputClass}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>

          {/* Role is auto-assigned: participants register here, organizers are invited by admin */}

          {error && (
            <div className="text-[12px] text-scribia-red bg-scribia-red/8 border border-scribia-red/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-purple text-white text-[14px] font-medium hover:bg-purple-light glow-purple disabled:opacity-50 transition-all"
          >
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>

        <p className="text-center text-[13px] text-text3 mt-6">
          Já tem conta?{' '}
          <Link href="/login" className="text-purple-light hover:text-purple transition-colors">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
