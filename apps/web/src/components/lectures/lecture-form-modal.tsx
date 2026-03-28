'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase-browser'
import { Modal } from '@/components/ui/modal'
import { Plus } from 'lucide-react'

const lectureSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  speaker_id: z.string().optional(),
  scheduled_at: z.string().optional(),
  duration_seconds: z.string().optional(),
})

type LectureFormData = z.infer<typeof lectureSchema>

interface Speaker {
  id: string
  name: string
}

interface LectureFormModalProps {
  eventId: string
  speakers: Speaker[]
  lecture?: { id: string; title: string; description: string | null; speaker_id: string | null; scheduled_at: string | null; duration_seconds: number | null }
  onClose: () => void
  onSaved: () => void
  onCreateSpeaker: () => void
}

export function LectureFormModal({ eventId, speakers, lecture, onClose, onSaved, onCreateSpeaker }: LectureFormModalProps) {
  const supabase = createClient()
  const [error, setError] = useState<string | null>(null)
  const isEditing = !!lecture

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LectureFormData>({
    resolver: zodResolver(lectureSchema),
    defaultValues: lecture ? {
      title: lecture.title,
      description: lecture.description ?? '',
      speaker_id: lecture.speaker_id ?? '',
      scheduled_at: lecture.scheduled_at?.slice(0, 16) ?? '',
      duration_seconds: lecture.duration_seconds?.toString() ?? '',
    } : {},
  })

  async function onSubmit(data: LectureFormData) {
    setError(null)
    const payload = {
      title: data.title,
      description: data.description || null,
      speaker_id: data.speaker_id || null,
      scheduled_at: data.scheduled_at || null,
      duration_seconds: data.duration_seconds ? parseInt(data.duration_seconds, 10) : null,
      event_id: eventId,
    }

    if (isEditing) {
      const { error } = await supabase.from('lectures').update(payload as never).eq('id', lecture.id)
      if (error) { setError(error.message); return }
    } else {
      const { error } = await supabase.from('lectures').insert(payload as never)
      if (error) { setError(error.message); return }
    }

    onSaved()
  }

  const inputClass =
    'w-full bg-bg3 border border-border-subtle rounded-lg px-3.5 py-2.5 text-[13px] text-text placeholder:text-text3 outline-none transition-all focus:border-border-purple focus:ring-1 focus:ring-purple/20'
  const labelClass = 'block text-[12px] font-medium text-text2 mb-1.5'

  return (
    <Modal title={isEditing ? 'Editar Palestra' : 'Nova Palestra'} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className={labelClass}>Título *</label>
          <input {...register('title')} className={inputClass} placeholder="Nome da palestra" />
          {errors.title && <p className="text-[11px] text-scribia-red mt-1">{errors.title.message}</p>}
        </div>

        <div>
          <label className={labelClass}>Descrição</label>
          <textarea {...register('description')} rows={2} className={inputClass} placeholder="Breve descrição" />
        </div>

        <div>
          <label className={labelClass}>Palestrante</label>
          <div className="flex gap-2">
            <select {...register('speaker_id')} className={`flex-1 ${inputClass}`}>
              <option value="">Sem palestrante</option>
              {speakers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={onCreateSpeaker}
              className="shrink-0 w-9 h-9 rounded-lg bg-bg3 border border-border-subtle flex items-center justify-center text-text2 hover:border-border-purple hover:text-purple-light transition-all"
              title="Novo palestrante"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Data/Hora</label>
            <input {...register('scheduled_at')} type="datetime-local" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Duração (min)</label>
            <input {...register('duration_seconds')} type="number" className={inputClass} placeholder="60" />
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
