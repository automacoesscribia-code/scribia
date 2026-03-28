'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Search, Upload, Download, UserPlus, Trash2, Mail } from 'lucide-react'

interface Participant {
  id: string
  user_id: string
  attended: boolean
  registered_at: string
  user_profiles: { full_name: string; email: string } | null
}

interface ParticipantsTabProps {
  eventId: string
  participants: Participant[]
  lectureIds: string[]
}

export function ParticipantsTab({ eventId, participants: initial, lectureIds }: ParticipantsTabProps) {
  const [participants, setParticipants] = useState(initial)
  const [email, setEmail] = useState('')
  const [search, setSearch] = useState('')
  const [filterPresence, setFilterPresence] = useState<'all' | 'present' | 'absent'>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('event_participants')
      .select('id, user_id, attended, registered_at, user_profiles(full_name, email)')
      .eq('event_id', eventId)
    if (data) setParticipants(data as unknown as Participant[])
  }, [supabase, eventId])

  async function inviteViaEdgeFunction(targetEmail: string): Promise<{ ok: boolean; message: string }> {
    // Force token refresh to avoid stale JWT
    const { data: { session }, error: refreshErr } = await supabase.auth.refreshSession()
    if (refreshErr || !session) {
      return { ok: false, message: 'Sessão expirada. Faça login novamente.' }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const response = await fetch(`${supabaseUrl}/functions/v1/send-invitation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': anonKey!,
      },
      body: JSON.stringify({
        email: targetEmail,
        role: 'participant',
        event_id: eventId,
      }),
    })

    const result = await response.json().catch(() => null)

    if (!response.ok) {
      return { ok: false, message: result?.error || `Erro ${response.status}: ${response.statusText}` }
    }

    return { ok: true, message: result?.message || `Convite enviado para ${targetEmail}` }
  }

  async function addByEmail() {
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    setSuccess(null)

    const trimmedEmail = email.trim()

    // Check if user already exists in the platform
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', trimmedEmail)
      .maybeSingle()

    const userId = (existing as { id: string } | null)?.id

    if (userId) {
      // User exists — add directly to event
      const { error: insertErr } = await supabase
        .from('event_participants')
        .insert({ event_id: eventId, user_id: userId } as never)

      if (insertErr) {
        if (insertErr.code === '23505') {
          setError('Este participante já está registrado neste evento.')
        } else {
          setError(`Erro ao adicionar: ${insertErr.message}`)
        }
        setLoading(false)
        return
      }

      // lecture_access is granted automatically by DB trigger
      setSuccess(`${trimmedEmail} adicionado ao evento.`)
    } else {
      // User doesn't exist — send invitation via edge function
      const result = await inviteViaEdgeFunction(trimmedEmail)
      if (!result.ok) {
        setError(result.message)
        setLoading(false)
        return
      }
      setSuccess(`Convite enviado para ${trimmedEmail}. Ao aceitar, será registrado automaticamente no evento.`)
    }

    setEmail('')
    setLoading(false)
    await refresh()
  }

  async function importCSV(file: File) {
    setLoading(true)
    setError(null)
    setSuccess(null)
    const text = await file.text()
    const lines = text.split('\n').slice(1).filter(Boolean)
    let added = 0
    let invited = 0
    let failed = 0

    for (const line of lines) {
      const [, csvEmail] = line.split(',').map((s) => s.trim().replace(/"/g, ''))
      if (!csvEmail) continue

      const { data: existing } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', csvEmail)
        .maybeSingle()

      if (existing) {
        // User exists — add directly
        const userId = (existing as { id: string }).id
        const { error: insertErr } = await supabase
          .from('event_participants')
          .insert({ event_id: eventId, user_id: userId } as never)
        if (!insertErr) added++
        // lecture_access is granted automatically by DB trigger
      } else {
        // User doesn't exist — send invitation
        const result = await inviteViaEdgeFunction(csvEmail)
        if (result.ok) invited++
        else failed++
      }
    }

    setLoading(false)
    const parts: string[] = []
    if (added > 0) parts.push(`${added} adicionado(s)`)
    if (invited > 0) parts.push(`${invited} convite(s) enviado(s)`)
    if (failed > 0) parts.push(`${failed} falha(s)`)

    if (parts.length > 0) {
      if (added > 0 || invited > 0) {
        setSuccess(parts.join(', ') + '.')
        await refresh()
      } else {
        setError(parts.join(', ') + '.')
      }
    } else {
      setError('Nenhum email válido encontrado no CSV.')
    }
  }

  async function removeParticipant(participantId: string, userId: string) {
    if (!confirm('Remover este participante?')) return
    await supabase.from('lecture_access').delete().eq('user_id', userId).in('lecture_id', lectureIds)
    await supabase.from('event_participants').delete().eq('id', participantId)
    await refresh()
  }

  async function toggleAttendance(participantId: string, current: boolean) {
    await supabase.from('event_participants').update({ attended: !current } as never).eq('id', participantId)
    await refresh()
  }

  function exportCSV() {
    const header = 'nome,email,presente,data_registro\n'
    const rows = participants
      .map((p) => {
        const name = p.user_profiles?.full_name ?? ''
        const em = p.user_profiles?.email ?? ''
        return `"${name}","${em}",${p.attended ? 'sim' : 'nao'},${new Date(p.registered_at).toLocaleDateString('pt-BR')}`
      })
      .join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `participantes-${eventId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = participants.filter((p) => {
    const name = p.user_profiles?.full_name?.toLowerCase() ?? ''
    const em = p.user_profiles?.email?.toLowerCase() ?? ''
    const q = search.toLowerCase()
    const matchSearch = !q || name.includes(q) || em.includes(q)
    const matchPresence =
      filterPresence === 'all' ||
      (filterPresence === 'present' && p.attended) ||
      (filterPresence === 'absent' && !p.attended)
    return matchSearch && matchPresence
  })

  const totalRegistered = participants.length
  const totalPresent = participants.filter((p) => p.attended).length

  const inputClass =
    'bg-bg3 border border-border-subtle rounded-lg px-3.5 py-2.5 text-[13px] text-text placeholder:text-text3 outline-none transition-all focus:border-border-purple focus:ring-1 focus:ring-purple/20'

  return (
    <div>
      {/* Stats */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] text-text3">
          {totalRegistered} registrados, {totalPresent} presentes
        </p>
        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-1.5 text-[12px] bg-transparent border border-border-subtle text-text2 rounded-lg px-3 py-1.5 hover:border-border-purple hover:text-purple-light transition-all"
        >
          <Download className="w-3 h-3" />
          Exportar CSV
        </button>
      </div>

      {/* Add participant */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text3" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email do participante"
            className={`w-full pl-9 ${inputClass}`}
            onKeyDown={(e) => e.key === 'Enter' && addByEmail()}
          />
        </div>
        <button
          onClick={addByEmail}
          disabled={loading}
          className="px-4 py-2.5 rounded-lg bg-purple text-white text-[13px] font-medium hover:bg-purple-light glow-purple disabled:opacity-50 transition-all"
        >
          Adicionar
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-transparent border border-border-subtle text-[13px] text-text2 hover:border-border-purple hover:text-purple-light transition-all"
        >
          <Upload className="w-3.5 h-3.5" />
          CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && importCSV(e.target.files[0])}
        />
      </div>

      {error && (
        <div className="text-[11px] text-scribia-red bg-scribia-red/8 border border-scribia-red/20 rounded-lg px-3 py-2 mb-3">
          {error}
        </div>
      )}

      {success && (
        <div className="text-[11px] text-green-400 bg-green-400/8 border border-green-400/20 rounded-lg px-3 py-2 mb-3 flex items-center gap-1.5">
          <Mail className="w-3 h-3 shrink-0" />
          {success}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text3" />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pl-9 ${inputClass}`}
          />
        </div>
        <select
          value={filterPresence}
          onChange={(e) => setFilterPresence(e.target.value as 'all' | 'present' | 'absent')}
          className={inputClass}
        >
          <option value="all">Todos</option>
          <option value="present">Presentes</option>
          <option value="absent">Ausentes</option>
        </select>
      </div>

      {/* List */}
      {filtered.length > 0 ? (
        <div className="space-y-1.5">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 bg-bg2 border border-border-subtle rounded-xl p-3.5 transition-all hover:border-border-purple"
            >
              <input
                type="checkbox"
                checked={p.attended}
                onChange={() => toggleAttendance(p.id, p.attended)}
                title="Marcar presença"
                className="h-4 w-4 rounded border-border-subtle bg-bg3 accent-purple"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[13px] text-text">
                  {p.user_profiles?.full_name || 'Sem nome'}
                </p>
                <p className="text-[11px] text-text3">{p.user_profiles?.email}</p>
              </div>
              <span className="text-[11px] text-text3">
                {new Date(p.registered_at).toLocaleDateString('pt-BR')}
              </span>
              <button
                onClick={() => removeParticipant(p.id, p.user_id)}
                className="w-7 h-7 rounded-md bg-bg3 border border-border-subtle flex items-center justify-center text-text2 hover:border-scribia-red/40 hover:bg-scribia-red/8 hover:text-scribia-red transition-all"
                title="Remover"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-text3 text-center py-12 text-[13px]">
          Nenhum participante encontrado.
        </p>
      )}
    </div>
  )
}
