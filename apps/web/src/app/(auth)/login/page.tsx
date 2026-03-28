'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mail, Lock, Send } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('roles')
      .eq('id', data.user.id)
      .single()

    const roles = (profile as { roles: string[] } | null)?.roles ?? []
    const redirectTo = roles.includes('super_admin') ? '/admin' : roles.includes('organizer') ? '/dashboard' : '/portal'
    window.location.href = redirectTo
  }

  async function handleMagicLink() {
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({ email })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setMagicLinkSent(true)
    setLoading(false)
  }

  const inputClass =
    'w-full bg-bg3 border border-border-subtle rounded-lg pl-10 pr-3.5 py-3 text-[14px] text-text placeholder:text-text3 outline-none transition-all focus:border-border-purple focus:ring-2 focus:ring-purple/20'

  if (magicLinkSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="w-full max-w-md bg-bg2 border border-border-subtle rounded-2xl p-8 animate-fade-up">
          <div className="w-12 h-12 rounded-xl bg-purple-dim border border-border-purple flex items-center justify-center mx-auto mb-5">
            <Send className="w-5 h-5 text-purple-light" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-text text-center">
            Verifique seu email
          </h1>
          <p className="text-[13px] text-text2 text-center mt-3">
            Enviamos um link mágico para <strong className="text-purple-light">{email}</strong>.
            <br />Clique no link para entrar.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="w-full max-w-md bg-bg2 border border-border-subtle rounded-2xl p-8 animate-fade-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-heading text-3xl font-extrabold text-purple-light tracking-tight">
            SCRIBIA
          </h1>
          <p className="text-[13px] text-text3 mt-2">
            Acesse sua conta para continuar
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-[12px] font-medium text-text2 mb-1.5">
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
            <label htmlFor="password" className="block text-[12px] font-medium text-text2 mb-1.5">
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
                className={inputClass}
                placeholder="••••••••"
              />
            </div>
          </div>

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
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border-subtle" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-bg2 px-3 text-[11px] uppercase text-text3 tracking-wider">
              ou
            </span>
          </div>
        </div>

        <button
          onClick={handleMagicLink}
          disabled={!email || loading}
          className="w-full py-3 rounded-lg bg-transparent border border-border-subtle text-[14px] text-text2 hover:border-border-purple hover:text-purple-light disabled:opacity-50 transition-all"
        >
          Entrar com link mágico
        </button>

        <p className="text-center text-[13px] text-text3 mt-6">
          Não tem conta?{' '}
          <Link href="/register" className="text-purple-light hover:text-purple transition-colors">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  )
}
