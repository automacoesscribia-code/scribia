'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase-browser'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

const eventSchema = z
  .object({
    name: z.string().min(1, 'Nome é obrigatório'),
    description: z.string().optional(),
    start_date: z.string().min(1, 'Data início é obrigatória'),
    end_date: z.string().min(1, 'Data fim é obrigatória'),
    location: z.string().optional(),
  })
  .refine((d) => d.end_date >= d.start_date, {
    message: 'Data fim deve ser >= data início',
    path: ['end_date'],
  })

type EventFormData = z.infer<typeof eventSchema>

export default function NewEventPage() {
  const router = useRouter()
  const supabase = createClient()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
  })

  async function onSubmit(data: EventFormData) {
    setServerError(null)

    // Get user directly at submit time — don't rely on hook state
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      setServerError('Usuário não autenticado. Recarregue a página e faça login novamente.')
      console.error('[new-event] auth error:', authError)
      return
    }

    console.log('[new-event] user:', user.id)
    console.log('[new-event] inserting event:', data)

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        name: data.name,
        description: data.description || null,
        start_date: new Date(data.start_date).toISOString(),
        end_date: new Date(data.end_date).toISOString(),
        location: data.location || null,
        organizer_id: user.id,
      } as never)
      .select()
      .single()

    if (error) {
      console.error('[new-event] insert error:', error)
      setServerError(`Erro ao criar evento: ${error.message}`)
      return
    }

    console.log('[new-event] created:', event)
    router.push(`/dashboard/events/${(event as { id: string }).id}`)
  }

  const inputClass =
    'w-full bg-bg3 border border-border-subtle rounded-lg px-3.5 py-2.5 text-[13px] text-text placeholder:text-text3 outline-none transition-all focus:border-border-purple focus:ring-2 focus:ring-purple/20'
  const labelClass = 'block text-[12px] font-medium text-text2 mb-1.5'

  return (
    <div className="max-w-2xl">
      <Link
        href="/dashboard/events"
        className="inline-flex items-center gap-1 text-[13px] text-text3 hover:text-purple-light transition-colors mb-6"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Voltar
      </Link>

      <h1 className="font-heading text-xl sm:text-2xl font-bold text-text mb-5 sm:mb-6">
        Novo Evento
      </h1>

      <div className="bg-bg2 border border-border-subtle rounded-2xl p-4 sm:p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className={labelClass}>Nome *</label>
            <input
              {...register('name')}
              className={inputClass}
              placeholder="Nome do evento"
            />
            {errors.name && <p className="text-[11px] text-scribia-red mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className={labelClass}>Descrição</label>
            <textarea
              {...register('description')}
              rows={3}
              className={inputClass}
              placeholder="Descrição do evento"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Data início *</label>
              <input
                {...register('start_date')}
                type="datetime-local"
                className={inputClass}
              />
              {errors.start_date && (
                <p className="text-[11px] text-scribia-red mt-1">{errors.start_date.message}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Data fim *</label>
              <input
                {...register('end_date')}
                type="datetime-local"
                className={inputClass}
              />
              {errors.end_date && (
                <p className="text-[11px] text-scribia-red mt-1">{errors.end_date.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className={labelClass}>Local</label>
            <input
              {...register('location')}
              className={inputClass}
              placeholder="São Paulo, SP"
            />
          </div>

          {serverError && (
            <div className="text-[12px] text-scribia-red bg-scribia-red/8 border border-scribia-red/20 rounded-lg px-3 py-2">
              {serverError}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 border-t border-border-subtle">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-lg bg-purple text-white text-[13px] font-medium hover:bg-purple-light glow-purple disabled:opacity-50 transition-all"
            >
              {isSubmitting ? 'Criando...' : 'Criar Evento'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2.5 rounded-lg bg-transparent border border-border-subtle text-[13px] text-text2 hover:border-border-purple hover:text-purple-light transition-all"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
