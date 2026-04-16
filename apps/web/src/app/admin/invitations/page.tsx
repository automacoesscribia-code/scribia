'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useSearchParams } from 'next/navigation'
import { Plus, Mail, Clock, Check, X, Trash2, RefreshCw } from 'lucide-react'

interface Invitation {
  id: string
  email: string
  role: string
  status: string
  expires_at: string
  created_at: string
}

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'organizer' | 'participant'>('organizer')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [resending, setResending] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const supabase = createClient()

  async function loadInvitations() {
    const { data } = await supabase
      .from('invitations')
      .select('id, email, role, status, expires_at, created_at')
      .order('created_at', { ascending: false })

    setInvitations((data ?? []) as Invitation[])
    setLoading(false)
  }

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setShowForm(true)
      const roleParam = searchParams.get('role')
      if (roleParam === 'organizer' || roleParam === 'participant') {
        setInviteRole(roleParam)
      }
    }
    loadInvitations()
  }, [searchParams])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setMessage(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setMessage('Erro: Sessao expirada. Faca login novamente.')
      setSending(false)
      return
    }

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const res = await fetch(`${supabaseUrl}/functions/v1/send-invitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({ email, role: inviteRole }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setMessage(`Erro: ${data.error || res.statusText}`)
      } else {
        setMessage(data.message ?? `Convite enviado para ${email}`)
        setEmail('')
        loadInvitations()
      }
    } catch (err) {
      setMessage(`Erro: ${(err as Error).message}`)
    }
    setSending(false)
  }

  async function revokeInvitation(id: string) {
    await (supabase.from('invitations') as any)
      .update({ status: 'revoked' })
      .eq('id', id)
    loadInvitations()
  }

  async function deleteInvitation(id: string) {
    setDeleting(id)
    const { error } = await (supabase.from('invitations') as any)
      .delete()
      .eq('id', id)

    if (error) {
      setMessage(`Erro ao apagar: ${error.message}`)
    }
    setDeleting(null)
    loadInvitations()
  }

  async function resendInvitation(inv: Invitation) {
    setResending(inv.id)
    setMessage(null)

    // Delete old invitation first
    await (supabase.from('invitations') as any)
      .delete()
      .eq('id', inv.id)

    // Send new invitation
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setMessage('Erro: Sessao expirada.')
      setResending(null)
      return
    }

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const res = await fetch(`${supabaseUrl}/functions/v1/send-invitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({ email: inv.email, role: inv.role }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        setMessage(`Erro ao reenviar: ${data.error || res.statusText}`)
      } else {
        setMessage(data.message ?? `Convite reenviado para ${inv.email}`)
      }
    } catch (err) {
      setMessage(`Erro: ${(err as Error).message}`)
    }

    setResending(null)
    loadInvitations()
  }

  const statusIcon: Record<string, typeof Check> = {
    pending: Clock,
    accepted: Check,
    expired: X,
    revoked: X,
  }

  const statusLabel: Record<string, string> = {
    pending: 'Pendente',
    accepted: 'Aceito',
    expired: 'Expirado',
    revoked: 'Revogado',
  }

  const statusColor: Record<string, string> = {
    pending: 'text-scribia-yellow',
    accepted: 'text-scribia-green',
    expired: 'text-text3',
    revoked: 'text-scribia-red',
  }

  const roleLabel: Record<string, string> = {
    organizer: 'Organizador',
    participant: 'Participante',
    speaker: 'Palestrante',
  }

  const inputClass =
    'w-full bg-bg3 border border-border-subtle rounded-lg px-3.5 py-3 text-[14px] text-text placeholder:text-text3 outline-none transition-all focus:border-border-purple focus:ring-2 focus:ring-purple/20'

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 md:mb-9">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-text">Convites</h1>
          <p className="text-[13px] text-text3 mt-0.5">Gerencie convites para organizadores e participantes</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center justify-center gap-1.5 bg-purple text-white px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all hover:bg-purple-light glow-purple self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Novo Convite
        </button>
      </div>

      {/* Invite form */}
      {showForm && (
        <div className="bg-bg2 border border-border-subtle rounded-xl p-5 mb-6 animate-fade-up">
          <h2 className="font-heading text-[15px] font-bold text-text mb-4">Enviar Convite</h2>
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-text2 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-text2 mb-1.5">Role</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setInviteRole('organizer')}
                  className={`flex-1 py-2.5 rounded-lg border text-[13px] transition-all ${
                    inviteRole === 'organizer'
                      ? 'bg-purple-dim border-border-purple text-purple-light'
                      : 'bg-bg3 border-border-subtle text-text2 hover:border-border-purple'
                  }`}
                >
                  Organizador
                </button>
                <button
                  type="button"
                  onClick={() => setInviteRole('participant')}
                  className={`flex-1 py-2.5 rounded-lg border text-[13px] transition-all ${
                    inviteRole === 'participant'
                      ? 'bg-purple-dim border-border-purple text-purple-light'
                      : 'bg-bg3 border-border-subtle text-text2 hover:border-border-purple'
                  }`}
                >
                  Participante
                </button>
              </div>
            </div>

            {message && (
              <div className={`text-[12px] px-3 py-2 rounded-lg ${
                message.startsWith('Erro')
                  ? 'text-scribia-red bg-scribia-red/8 border border-scribia-red/20'
                  : 'text-scribia-green bg-scribia-green/8 border border-scribia-green/20'
              }`} style={{ whiteSpace: 'pre-line' }}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="w-full py-3 rounded-lg bg-purple text-white text-[14px] font-medium hover:bg-purple-light glow-purple disabled:opacity-50 transition-all"
            >
              {sending ? 'Enviando...' : 'Enviar Convite'}
            </button>
          </form>
        </div>
      )}

      {/* Global message (for resend/delete) */}
      {message && !showForm && (
        <div className={`text-[12px] px-3 py-2 rounded-lg mb-4 ${
          message.startsWith('Erro')
            ? 'text-scribia-red bg-scribia-red/8 border border-scribia-red/20'
            : 'text-scribia-green bg-scribia-green/8 border border-scribia-green/20'
        }`} style={{ whiteSpace: 'pre-line' }}>
          {message}
        </div>
      )}

      {/* Invitations list */}
      {loading ? (
        <p className="text-text3 text-[13px] text-center py-8">Carregando...</p>
      ) : invitations.length === 0 ? (
        <div className="text-center py-16">
          <Mail className="w-10 h-10 text-text3 mx-auto mb-3 opacity-50" />
          <p className="text-text3 text-[13px]">Nenhum convite enviado ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invitations.map((inv) => {
            const StatusIcon = statusIcon[inv.status] ?? Clock
            const isExpired = inv.status === 'pending' && new Date(inv.expires_at) < new Date()
            const displayStatus = isExpired ? 'expired' : inv.status
            const DisplayIcon = isExpired ? X : StatusIcon

            return (
              <div
                key={inv.id}
                className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 px-4 sm:px-5 py-3.5 sm:py-4 bg-bg2 border border-border-subtle rounded-xl"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <DisplayIcon className={`w-4 h-4 shrink-0 ${statusColor[displayStatus] ?? 'text-text3'}`} />
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-text truncate">{inv.email}</div>
                    <div className="text-[11px] text-text3 truncate">
                      {roleLabel[inv.role] ?? inv.role} · {statusLabel[displayStatus] ?? displayStatus}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 ml-auto">
                  <div className="text-[11px] text-text3 mr-2 hidden sm:block">
                    {new Date(inv.created_at).toLocaleDateString('pt-BR')}
                  </div>

                  {/* Resend — for pending or expired */}
                  {(inv.status === 'pending' || isExpired) && (
                    <button
                      onClick={() => resendInvitation(inv)}
                      disabled={resending === inv.id}
                      className="inline-flex items-center gap-1 text-[11px] text-purple-light hover:text-purple transition-colors disabled:opacity-50 cursor-pointer"
                      title="Reenviar convite"
                    >
                      <RefreshCw className={`w-3 h-3 ${resending === inv.id ? 'animate-spin' : ''}`} />
                      Reenviar
                    </button>
                  )}

                  {/* Revoke — only for pending */}
                  {inv.status === 'pending' && !isExpired && (
                    <button
                      onClick={() => revokeInvitation(inv.id)}
                      className="text-[11px] text-scribia-yellow hover:text-scribia-yellow/80 transition-colors cursor-pointer"
                    >
                      Revogar
                    </button>
                  )}

                  {/* Delete — always available */}
                  <button
                    onClick={() => deleteInvitation(inv.id)}
                    disabled={deleting === inv.id}
                    className="inline-flex items-center gap-1 text-[11px] text-scribia-red hover:text-scribia-red/80 transition-colors disabled:opacity-50 cursor-pointer"
                    title="Apagar convite"
                  >
                    <Trash2 className="w-3 h-3" />
                    Apagar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
