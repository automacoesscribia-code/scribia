'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase-browser'
import { Modal } from '@/components/ui/modal'

const speakerSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  bio: z.string().optional(),
  company: z.string().optional(),
  role: z.string().optional(),
})

type SpeakerFormData = z.infer<typeof speakerSchema>

interface SpeakerFormModalProps {
  speaker?: { id: string; name: string; email: string | null; bio: string | null; company: string | null; role: string | null }
  onClose: () => void
  onSaved: (speakerId?: string) => void
}

export function SpeakerFormModal({ speaker, onClose, onSaved }: SpeakerFormModalProps) {
  const supabase = createClient()
  const [error, setError] = useState<string | null>(null)
  const isEditing = !!speaker

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SpeakerFormData>({
    resolver: zodResolver(speakerSchema),
    defaultValues: speaker ? {
      name: speaker.name,
      email: speaker.email ?? '',
      bio: speaker.bio ?? '',
      company: speaker.company ?? '',
      role: speaker.role ?? '',
    } : {},
  })

  async function onSubmit(data: SpeakerFormData) {
    setError(null)
    const payload = {
      name: data.name,
      email: data.email || null,
      bio: data.bio || null,
      company: data.company || null,
      role: data.role || null,
    }

    if (isEditing) {
      const { error } = await supabase.from('speakers').update(payload as never).eq('id', speaker.id)
      if (error) { setError(error.message); return }
      onSaved()
    } else {
      const { data: newSpeaker, error } = await supabase.from('speakers').insert(payload as never).select().single()
      if (error) { setError(error.message); return }
      onSaved((newSpeaker as { id: string })?.id)
    }
  }

  const inputClass =
    'w-full bg-bg3 border border-border-subtle rounded-lg px-3.5 py-2.5 text-[13px] text-text placeholder:text-text3 outline-none transition-all focus:border-border-purple focus:ring-1 focus:ring-purple/20'
  const labelClass = 'block text-[12px] font-medium text-text2 mb-1.5'

  return (
    <Modal title={isEditing ? 'Editar Palestrante' : 'Novo Palestrante'} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className={labelClass}>Nome *</label>
          <input {...register('name')} className={inputClass} placeholder="Nome completo" />
          {errors.name && <p className="text-[11px] text-scribia-red mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label className={labelClass}>Email</label>
          <input {...register('email')} type="email" className={inputClass} placeholder="nome@empresa.com" />
          {errors.email && <p className="text-[11px] text-scribia-red mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className={labelClass}>Bio</label>
          <textarea {...register('bio')} rows={2} className={inputClass} placeholder="Breve biografia" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Empresa</label>
            <input {...register('company')} className={inputClass} placeholder="Empresa" />
          </div>
          <div>
            <label className={labelClass}>Cargo</label>
            <input {...register('role')} className={inputClass} placeholder="Cargo" />
          </div>
        </div>

        {error && <p className="text-[11px] text-scribia-red">{error}</p>}

        <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-transparent border border-border-subtle text-[13px] text-text2 hover:border-border-purple hover:text-purple-light transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-purple text-white text-[13px] font-medium hover:bg-purple-light glow-purple disabled:opacity-50 transition-all"
          >
            {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
