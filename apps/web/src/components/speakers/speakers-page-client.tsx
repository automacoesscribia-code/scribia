'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { Chip } from '@/components/ui/chip'
import {
  Mail,
  Send,
  Upload,
  Download,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'

interface ConfirmedSpeaker {
  id: string
  name: string
  email: string | null
  lectureTitle: string
}

interface PendingInvite {
  id: string
  email: string
  speakerName: string | null
  sentAt: string
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  expiresAt: string
}

interface SpeakersPageClientProps {
  eventId: string
  initialConfirmed: ConfirmedSpeaker[]
  initialPending: PendingInvite[]
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return 'agora'
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  return `há ${days}d`
}

function isExpired(expiresAt: string, status: string): boolean {
  if (status === 'expired' || status === 'revoked') return true
  return new Date(expiresAt).getTime() < Date.now()
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function SpeakersPageClient({
  eventId,
  initialConfirmed,
  initialPending,
}: SpeakersPageClientProps) {
  const [emailInput, setEmailInput] = useState('')
  const [emailTags, setEmailTags] = useState<string[]>([])
  const [confirmed] = useState(initialConfirmed)
  const [pending] = useState(initialPending)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  function addEmail() {
    const val = emailInput.trim()
    if (!val || !val.includes('@')) return
    if (emailTags.includes(val)) return
    setEmailTags((prev) => [...prev, val])
    setEmailInput('')
  }

  function removeTag(email: string) {
    setEmailTags((prev) => prev.filter((e) => e !== email))
  }

  async function sendInvites() {
    if (emailTags.length === 0) return
    setLoading(true)
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('Sessão expirada. Faça login novamente.')
      setLoading(false)
      return
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    let failCount = 0

    for (const email of emailTags) {
      const speakerName = email.split('@')[0].replace(/[._]/g, ' ')

      const response = await fetch(`${supabaseUrl}/functions/v1/send-invitation`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          role: 'speaker',
          event_id: eventId,
          speaker_name: speakerName,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        console.error(`Failed to invite ${email}:`, data.error)
        failCount++
      }
    }

    setEmailTags([])
    setLoading(false)

    if (failCount > 0) {
      setError(`${failCount} convite(s) falharam. Verifique os emails e tente novamente.`)
    }

    router.refresh()
  }

  async function revokeInvite(invitationId: string) {
    if (!confirm('Revogar este convite?')) return
    await supabase
      .from('invitations')
      .update({ status: 'revoked' } as never)
      .eq('id', invitationId)
    router.refresh()
  }

  async function resendInvite(email: string) {
    setLoading(true)
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('Sessão expirada.')
      setLoading(false)
      return
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    const response = await fetch(`${supabaseUrl}/functions/v1/send-invitation`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        role: 'speaker',
        event_id: eventId,
      }),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: 'Erro' }))
      setError(data.error || 'Erro ao reenviar convite')
    }

    setLoading(false)
    router.refresh()
  }

  function importCSV(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split('\n').slice(1).filter(Boolean)
      const emails: string[] = []
      for (const line of lines) {
        const parts = line.split(',').map((s) => s.trim().replace(/"/g, ''))
        const email = parts[1]
        if (email && email.includes('@') && !emailTags.includes(email)) {
          emails.push(email)
        }
      }
      setEmailTags((prev) => [...prev, ...emails])
    }
    reader.readAsText(file)
  }

  function downloadTemplate() {
    const csv = 'nome,email,empresa,cargo\n"João Silva","joao@empresa.com","TechCorp","CTO"\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modelo-palestrantes.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const inputClass =
    'w-full bg-bg3 border border-border-subtle rounded-xl pl-11 pr-4 py-3.5 text-[14px] text-text placeholder:text-text3 outline-none transition-all focus:border-border-purple focus:ring-2 focus:ring-purple/20'

  return (
    <div>
      {/* Error banner */}
      {error && (
        <div className="bg-scribia-red/8 border border-scribia-red/20 rounded-xl px-5 py-3 mb-4 text-[13px] text-scribia-red">
          {error}
        </div>
      )}

      {/* Invite section */}
      <div className="bg-bg2 border border-border-subtle rounded-2xl p-7 mb-6 animate-fade-up">
        <div className="font-heading text-base font-bold text-text mb-1">
          Convidar por e-mail
        </div>
        <p className="text-[13px] text-text3 mb-6">
          O palestrante receberá um email com link para criar sua conta
        </p>

        {/* Email input row */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text3" />
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addEmail()
                }
              }}
              placeholder="nome@empresa.com.br"
              className={inputClass}
            />
          </div>
          <button
            onClick={emailTags.length > 0 ? sendInvites : addEmail}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-purple text-white px-6 py-3.5 rounded-xl text-[14px] font-medium hover:bg-purple-light glow-purple disabled:opacity-50 transition-all whitespace-nowrap cursor-pointer"
          >
            <Send className="w-4 h-4" />
            {loading ? 'Enviando...' : emailTags.length > 0 ? `Enviar ${emailTags.length} convite${emailTags.length > 1 ? 's' : ''}` : 'Adicionar'}
          </button>
        </div>

        {/* Email tags */}
        {emailTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {emailTags.map((email) => (
              <div
                key={email}
                className="bg-purple-dim border border-border-purple rounded-full px-3 py-1 text-[12px] text-purple-light flex items-center gap-1.5"
              >
                {email}
                <button
                  onClick={() => removeTag(email)}
                  className="opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              onClick={sendInvites}
              disabled={loading}
              className="bg-purple text-white rounded-full px-4 py-1 text-[12px] font-medium hover:bg-purple-light disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? 'Enviando...' : 'Enviar todos'}
            </button>
          </div>
        )}

        {/* Divider + CSV */}
        <div className="flex items-center gap-4 mt-5">
          <div className="flex-1 h-px bg-border-subtle" />
          <span className="text-[11.5px] text-text3">ou</span>
          <div className="flex-1 h-px bg-border-subtle" />
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 bg-transparent border border-border-subtle rounded-lg px-4 py-2.5 text-[12.5px] text-text2 hover:border-border-purple hover:text-purple-light transition-all cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Importar CSV
          </button>
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 bg-transparent border border-border-subtle rounded-lg px-4 py-2.5 text-[12.5px] text-text2 hover:border-border-purple hover:text-purple-light transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Baixar modelo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && importCSV(e.target.files[0])}
          />
        </div>
      </div>

      {/* Lists Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-up" style={{ animationDelay: '0.15s' }}>
        {/* Pending invites */}
        <div className="bg-bg2 border border-border-subtle rounded-[14px] overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
            <div className="font-heading text-[13px] font-bold text-text flex items-center gap-2">
              Convites pendentes
              <span className="bg-bg3 border border-border-subtle rounded-full px-2.5 py-0.5 text-[11px] text-text2 font-normal font-sans">
                {pending.length}
              </span>
            </div>
          </div>
          {pending.length > 0 ? (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-[10px] text-text3 uppercase tracking-[0.8px] px-5 py-2.5 text-left border-b border-border-subtle">
                    E-mail
                  </th>
                  <th className="text-[10px] text-text3 uppercase tracking-[0.8px] px-5 py-2.5 text-left border-b border-border-subtle">
                    Enviado em
                  </th>
                  <th className="text-[10px] text-text3 uppercase tracking-[0.8px] px-5 py-2.5 text-left border-b border-border-subtle">
                    Status
                  </th>
                  <th className="text-[10px] text-text3 uppercase tracking-[0.8px] px-5 py-2.5 text-left border-b border-border-subtle" />
                </tr>
              </thead>
              <tbody>
                {pending.map((invite) => {
                  const expired = isExpired(invite.expiresAt, invite.status)
                  return (
                    <tr key={invite.id} className="transition-colors hover:bg-bg3">
                      <td className="px-5 py-3 text-[13px] text-text border-b border-border-subtle">
                        <div>{invite.email}</div>
                        {invite.speakerName && (
                          <div className="text-[11px] text-text3">{invite.speakerName}</div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-[13px] text-text3 border-b border-border-subtle">
                        {timeAgo(invite.sentAt)}
                      </td>
                      <td className="px-5 py-3 border-b border-border-subtle">
                        <Chip variant={expired ? 'red' : 'yellow'}>
                          {expired ? 'Expirado' : 'Pendente'}
                        </Chip>
                      </td>
                      <td className="px-5 py-3 border-b border-border-subtle">
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => resendInvite(invite.email)}
                            disabled={loading}
                            className="w-[26px] h-[26px] rounded-md bg-bg3 border border-border-subtle flex items-center justify-center text-text2 hover:border-border-purple hover:bg-purple-dim hover:text-purple-light transition-all cursor-pointer disabled:opacity-50"
                            title="Reenviar"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => revokeInvite(invite.id)}
                            className="w-[26px] h-[26px] rounded-md bg-bg3 border border-border-subtle flex items-center justify-center text-text2 hover:border-scribia-red/40 hover:bg-scribia-red/8 hover:text-scribia-red transition-all cursor-pointer"
                            title="Revogar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className="px-5 py-8 text-center text-[13px] text-text3">
              Nenhum convite pendente.
            </div>
          )}
        </div>

        {/* Confirmed speakers */}
        <div className="bg-bg2 border border-border-subtle rounded-[14px] overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
            <div className="font-heading text-[13px] font-bold text-text flex items-center gap-2">
              Palestrantes confirmados
              <span className="bg-bg3 border border-border-subtle rounded-full px-2.5 py-0.5 text-[11px] text-text2 font-normal font-sans">
                {confirmed.length}
              </span>
            </div>
          </div>
          {confirmed.length > 0 ? (
            <div className="py-2">
              {confirmed.map((speaker) => (
                <div
                  key={speaker.id}
                  className="flex items-center gap-3 px-5 py-3 border-b border-border-subtle last:border-b-0 transition-colors hover:bg-bg3"
                >
                  <div className="w-9 h-9 rounded-full bg-purple-dim border border-border-purple flex items-center justify-center text-[12px] font-heading font-extrabold text-purple-light shrink-0">
                    {getInitials(speaker.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-text">
                      {speaker.name}
                    </div>
                    <div className="text-[11px] text-text3 truncate mt-0.5">
                      {speaker.lectureTitle}
                    </div>
                  </div>
                  <Chip variant="green">Ativo</Chip>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center text-[13px] text-text3">
              Nenhum palestrante confirmado.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
