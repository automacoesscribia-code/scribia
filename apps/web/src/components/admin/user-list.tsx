'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

interface User {
  id: string
  email: string
  full_name: string
  roles: string[]
  created_at: string
}

interface UserListProps {
  users: User[]
  extraInfo?: Record<string, string>
}

export function UserList({ users, extraInfo }: UserListProps) {
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleDelete(user: User) {
    const confirmed = confirm(
      `Tem certeza que deseja deletar ${user.full_name || user.email}?\n\nIsso vai remover:\n- Perfil do usuario\n- Todos os eventos criados\n- Participacoes em eventos\n- Acesso a materiais\n- Convites enviados\n- Conta de autenticacao\n\nEssa acao NAO pode ser desfeita.`
    )
    if (!confirmed) return

    setDeleting(user.id)
    setError(null)

    try {
      const res = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || 'Erro ao deletar usuario')
      } else {
        router.refresh()
      }
    } catch (err) {
      setError((err as Error).message)
    }

    setDeleting(null)
  }

  const roleLabel: Record<string, string> = {
    super_admin: 'Super Admin',
    organizer: 'Organizador',
    participant: 'Participante',
    speaker: 'Palestrante',
  }

  return (
    <div>
      {error && (
        <div className="text-[12px] text-scribia-red bg-scribia-red/8 border border-scribia-red/20 rounded-lg px-3 py-2 mb-3">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 px-4 sm:px-5 py-3.5 sm:py-4 bg-bg2 border border-border-subtle rounded-xl"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-full bg-purple-dim border border-border-purple flex items-center justify-center text-xs font-heading font-bold text-purple-light shrink-0">
                {(user.full_name || user.email)[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-text truncate">{user.full_name || 'Sem nome'}</div>
                <div className="text-[11px] text-text3 truncate">
                  {user.email} · {user.roles.map((r) => roleLabel[r] ?? r).join(', ')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 ml-auto">
              {extraInfo?.[user.id] && (
                <div className="text-right hidden sm:block">
                  <div className="text-[11px] text-text3">{extraInfo[user.id]}</div>
                </div>
              )}
              <div className="text-[11px] text-text3 hidden md:block">
                desde {new Date(user.created_at).toLocaleDateString('pt-BR')}
              </div>
              <button
                onClick={() => handleDelete(user)}
                disabled={deleting === user.id}
                className="w-8 h-8 rounded-lg bg-bg3 border border-border-subtle flex items-center justify-center text-text3 hover:border-scribia-red/40 hover:bg-scribia-red/8 hover:text-scribia-red transition-all disabled:opacity-50 cursor-pointer shrink-0"
                title="Deletar usuario completamente"
              >
                <Trash2 className={`w-3.5 h-3.5 ${deleting === user.id ? 'animate-pulse' : ''}`} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
