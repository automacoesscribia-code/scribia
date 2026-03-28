'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useSearchParams, useRouter } from 'next/navigation'
import { Lock, Check, AlertCircle } from 'lucide-react'

export default function SetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="w-full max-w-md bg-bg2 border border-border-subtle rounded-2xl p-8 text-center">
          <h1 className="font-heading text-xl font-bold text-text">Carregando...</h1>
        </div>
      </div>
    }>
      <SetPasswordContent />
    </Suspense>
  )
}

function SetPasswordContent() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionError, setSessionError] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  const token = searchParams.get('token')

  useEffect(() => {
    // The Supabase invite link uses implicit flow:
    // tokens arrive in the URL hash fragment (#access_token=...&type=invite)
    // The browser Supabase client auto-detects these and establishes a session.

    let timeout: ReturnType<typeof setTimeout>

    async function initSession() {
      const hash = window.location.hash

      // If hash contains invite tokens, clear any stale session first
      // to prevent "Invalid Refresh Token" errors from old cookies
      if (hash && hash.includes('access_token')) {
        await supabase.auth.signOut({ scope: 'local' })
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
          setSessionReady(true)
          clearTimeout(timeout)
        }
      })

      // Also check if session already exists (page reload after session established)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setSessionReady(true)
        clearTimeout(timeout)
      }

      // Timeout: if no session after 30 seconds, show error
      timeout = setTimeout(() => {
        setSessionError(true)
      }, 30000)

      return () => {
        subscription.unsubscribe()
        clearTimeout(timeout)
      }
    }

    let cleanup: (() => void) | undefined
    initSession().then((fn) => { cleanup = fn })

    return () => { cleanup?.() }
  }, [supabase])

  const handleSetPassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('As senhas nao coincidem')
      return
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // Accept the invitation via API route (uses service role to bypass RLS)
    if (token) {
      try {
        const res = await fetch('/api/accept-invitation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        if (!res.ok) {
          const data = await res.json()
          console.warn('Invitation accept warning:', data.error)
        }
      } catch (err) {
        console.warn('Invitation accept error:', err)
      }
    }

    setSuccess(true)

    // Redirect based on role
    setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('roles')
          .eq('id', user.id)
          .single()

        const roles = (profile as { roles: string[] } | null)?.roles ?? []
        let redirectTo = '/portal'
        if (roles.includes('super_admin')) redirectTo = '/admin'
        else if (roles.includes('organizer')) redirectTo = '/dashboard'
        else if (roles.includes('speaker')) redirectTo = '/speaker'
        router.push(redirectTo)
      } else {
        router.push('/login')
      }
    }, 2000)
  }, [password, confirmPassword, token, supabase, router])

  const inputClass =
    'w-full bg-bg3 border border-border-subtle rounded-lg pl-10 pr-3.5 py-3 text-[14px] text-text placeholder:text-text3 outline-none transition-all focus:border-border-purple focus:ring-2 focus:ring-purple/20'

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="w-full max-w-md bg-bg2 border border-border-subtle rounded-2xl p-8 animate-fade-up text-center">
          <div className="w-12 h-12 rounded-xl bg-scribia-green/10 border border-scribia-green/20 flex items-center justify-center mx-auto mb-5">
            <Check className="w-6 h-6 text-scribia-green" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-text">Senha definida!</h1>
          <p className="text-[13px] text-text2 mt-3">Redirecionando para o painel...</p>
        </div>
      </div>
    )
  }

  // Session error — link might have expired
  if (sessionError && !sessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="w-full max-w-md bg-bg2 border border-border-subtle rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-scribia-red/10 border border-scribia-red/20 flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-6 h-6 text-scribia-red" />
          </div>
          <h1 className="font-heading text-xl font-bold text-text">Link expirado ou invalido</h1>
          <p className="text-[13px] text-text3 mt-3">
            O link de convite pode ter expirado. Peca um novo convite ao administrador.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="mt-6 px-6 py-2.5 rounded-lg bg-purple text-white text-[13px] font-medium hover:bg-purple-light transition-all"
          >
            Ir para login
          </button>
        </div>
      </div>
    )
  }

  // Waiting for session
  if (!sessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="w-full max-w-md bg-bg2 border border-border-subtle rounded-2xl p-8 text-center">
          <h1 className="font-heading text-xl font-bold text-text">Verificando convite...</h1>
          <p className="text-[13px] text-text3 mt-2">Aguarde um momento</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="w-full max-w-md bg-bg2 border border-border-subtle rounded-2xl p-8 animate-fade-up">
        <div className="text-center mb-8">
          <h1 className="font-heading text-3xl font-extrabold text-purple-light tracking-tight">
            SCRIBIA
          </h1>
          <p className="text-[13px] text-text3 mt-2">
            Defina sua senha para acessar a plataforma
          </p>
        </div>

        <form onSubmit={handleSetPassword} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-[12px] font-medium text-text2 mb-1.5">
              Nova senha
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
                placeholder="Minimo 6 caracteres"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-[12px] font-medium text-text2 mb-1.5">
              Confirmar senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text3" />
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className={inputClass}
                placeholder="Repita a senha"
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
            {loading ? 'Salvando...' : 'Definir senha e entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
