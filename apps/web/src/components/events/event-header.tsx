'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import Link from 'next/link'
import { ChevronLeft, Check, X, Zap, Archive } from 'lucide-react'

interface EventData {
  id: string
  name: string
  description: string | null
  start_date: string
  end_date: string
  location: string | null
  status: string
  cover_image_url: string | null
}

export function EventHeader({ event }: { event: EventData }) {
  const router = useRouter()
  const supabase = createClient()
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  async function saveField(field: string) {
    await supabase
      .from('events')
      .update({ [field]: editValue } as never)
      .eq('id', event.id)
    setEditing(null)
    router.refresh()
  }

  async function activateEvent() {
    await supabase.from('events').update({ status: 'active' } as never).eq('id', event.id)
    router.refresh()
  }

  async function archiveEvent() {
    if (!confirm('Tem certeza que deseja arquivar este evento?')) return
    await supabase.from('events').update({ status: 'archived' } as never).eq('id', event.id)
    router.push('/dashboard')
  }

  function startEdit(field: string, currentValue: string) {
    setEditing(field)
    setEditValue(currentValue || '')
  }

  return (
    <div className="mb-7 md:mb-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-[13px] text-text3 hover:text-purple-light transition-colors mb-4"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Voltar aos eventos
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          {editing === 'name' ? (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="font-heading text-xl sm:text-2xl font-bold text-text bg-transparent border-b-2 border-purple outline-none flex-1 min-w-0"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && saveField('name')}
              />
              <button
                onClick={() => saveField('name')}
                className="p-1.5 rounded-lg bg-purple-dim text-purple-light hover:bg-purple/20 transition-colors"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => setEditing(null)}
                className="p-1.5 rounded-lg bg-bg3 text-text3 hover:text-text transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <h1
              className="font-heading text-xl sm:text-2xl font-bold text-text cursor-pointer hover:text-purple-light transition-colors break-words"
              onClick={() => startEdit('name', event.name)}
              title="Clique para editar"
            >
              {event.name}
            </h1>
          )}

          {editing === 'description' ? (
            <div className="mt-3">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full bg-bg3 border border-border-subtle rounded-lg p-3 text-text text-[13px] outline-none focus:border-border-purple"
                rows={2}
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => saveField('description')}
                  className="text-[12px] text-purple-light hover:text-purple transition-colors"
                >
                  Salvar
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="text-[12px] text-text3 hover:text-text transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <p
              className="mt-2 text-[13px] text-text2 cursor-pointer hover:text-purple-light transition-colors"
              onClick={() => startEdit('description', event.description || '')}
            >
              {event.description || 'Adicionar descrição...'}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-text3">
            <span>
              {new Date(event.start_date).toLocaleDateString('pt-BR')} —{' '}
              {new Date(event.end_date).toLocaleDateString('pt-BR')}
            </span>
            {event.location && <span>{event.location}</span>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {event.status === 'draft' && (
            <button
              onClick={activateEvent}
              className="inline-flex items-center gap-1.5 bg-scribia-green/10 border border-scribia-green/30 text-scribia-green rounded-lg px-4 py-2 text-[13px] font-medium hover:bg-scribia-green/20 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              Ativar Evento
            </button>
          )}
          <button
            onClick={archiveEvent}
            className="inline-flex items-center gap-1.5 bg-scribia-red/10 border border-scribia-red/25 text-scribia-red rounded-lg px-4 py-2 text-[13px] font-medium hover:bg-scribia-red/20 transition-colors"
          >
            <Archive className="w-3.5 h-3.5" />
            Arquivar
          </button>
        </div>
      </div>
    </div>
  )
}
