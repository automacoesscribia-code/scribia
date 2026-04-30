'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import {
  BookOpen,
  FileText,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { PROFILE_LABELS } from './profile-selection'

interface Material {
  id: string
  profile_type: string
  content_type: 'ebook' | 'playbook'
  markdown_content: string | null
  pdf_url: string | null
  status: 'pending' | 'generating' | 'completed' | 'failed'
  word_count: number | null
}

interface Props {
  lectureId: string
  selectedProfiles: string[]
}

const STATUS_CONFIG = {
  pending: { icon: Clock, label: 'Pendente', color: 'text-text3', bg: 'bg-bg3' },
  generating: { icon: Loader2, label: 'Gerando...', color: 'text-scribia-yellow', bg: 'bg-scribia-yellow/10' },
  completed: { icon: CheckCircle, label: 'Pronto', color: 'text-scribia-green', bg: 'bg-scribia-green/10' },
  failed: { icon: AlertCircle, label: 'Falhou', color: 'text-scribia-red', bg: 'bg-scribia-red/10' },
}

export function ProfileMaterialsView({ lectureId, selectedProfiles }: Props) {
  const [materials, setMaterials] = useState<Material[]>([])
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const supabase = createClient()

  // Load materials
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('lecture_materials')
        .select('id, profile_type, content_type, markdown_content, pdf_url, status, word_count')
        .eq('lecture_id', lectureId)
        .order('profile_type')

      setMaterials((data as Material[]) || [])
      setLoading(false)
    }
    load()
  }, [lectureId, supabase])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`materials-${lectureId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lecture_materials',
          filter: `lecture_id=eq.${lectureId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMaterials(prev => [...prev, payload.new as Material])
          } else if (payload.eventType === 'UPDATE') {
            setMaterials(prev =>
              prev.map(m => m.id === (payload.new as Material).id ? payload.new as Material : m)
            )
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [lectureId, supabase])

  async function deleteMaterial(materialId: string) {
    setDeleting(materialId)
    try {
      const res = await fetch(`/api/materials/${lectureId}/delete?id=${materialId}`, { method: 'DELETE' })
      if (res.ok) {
        setMaterials(prev => prev.filter(m => m.id !== materialId))
      }
    } catch (e) {
      console.error('Delete material error:', e)
    }
    setDeleting(null)
  }

  async function deleteProfile(profile: string) {
    if (!confirm(`Excluir ebook e playbook do perfil "${PROFILE_LABELS[profile]?.label || profile}"?`)) return
    setDeleting(profile)
    try {
      const res = await fetch(`/api/materials/${lectureId}/delete?profile=${profile}`, { method: 'DELETE' })
      if (res.ok) {
        setMaterials(prev => prev.filter(m => m.profile_type !== profile))
        setExpandedProfile(null)
      }
    } catch (e) {
      console.error('Delete profile materials error:', e)
    }
    setDeleting(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-text3" />
      </div>
    )
  }

  // Group materials by profile
  const completedCount = materials.filter(m => m.status === 'completed').length
  const totalExpected = selectedProfiles.length * 2 // ebook + playbook per profile

  // All possible profiles (selected + any already generated)
  const allProfiles = Array.from(new Set([
    ...selectedProfiles,
    ...materials.map(m => m.profile_type),
  ])).sort()

  if (allProfiles.length === 0 && materials.length === 0) return null

  return (
    <div>
      {totalExpected > 0 && (
        <div className="flex items-center justify-between mb-3">
          <div className="text-[12px] text-text3 uppercase tracking-wider">Materiais Gerados</div>
          <span className="text-[11px] text-text3">
            {completedCount}/{totalExpected} gerados
          </span>
        </div>
      )}

      {/* Progress bar */}
      {totalExpected > 0 && completedCount < totalExpected && (
        <div className="mb-4">
          <div className="h-1.5 bg-bg3 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / totalExpected) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Profile accordion */}
      <div className="space-y-2">
        {allProfiles.map(profile => {
          const profileMaterials = materials.filter(m => m.profile_type === profile)
          const ebook = profileMaterials.find(m => m.content_type === 'ebook')
          const playbook = profileMaterials.find(m => m.content_type === 'playbook')
          const isSelected = selectedProfiles.includes(profile)
          const isExpanded = expandedProfile === profile
          const label = PROFILE_LABELS[profile]?.label || profile

          // Overall profile status
          const statuses = [ebook?.status, playbook?.status].filter(Boolean)
          const profileStatus = !isSelected && statuses.length === 0
            ? 'not_requested'
            : statuses.includes('generating')
              ? 'generating'
              : statuses.includes('failed')
                ? 'failed'
                : statuses.every(s => s === 'completed')
                  ? 'completed'
                  : 'pending'

          return (
            <div
              key={profile}
              className={`border rounded-xl overflow-hidden transition-all ${
                !isSelected && statuses.length === 0
                  ? 'border-border-subtle opacity-50'
                  : profileStatus === 'completed'
                    ? 'border-scribia-green/30'
                    : profileStatus === 'generating'
                      ? 'border-scribia-yellow/30'
                      : profileStatus === 'failed'
                        ? 'border-scribia-red/30'
                        : 'border-border-subtle'
              }`}
            >
              {/* Header */}
              <button
                type="button"
                onClick={() => setExpandedProfile(isExpanded ? null : profile)}
                className="w-full flex items-center justify-between p-3.5 text-left cursor-pointer hover:bg-bg3/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-medium text-text">{label}</span>
                  {profileStatus === 'not_requested' && (
                    <span className="text-[10px] text-text3 italic">Nao solicitado</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {profileStatus !== 'not_requested' && profileStatus in STATUS_CONFIG && (
                    <span className={`text-[10px] ${STATUS_CONFIG[profileStatus as keyof typeof STATUS_CONFIG].color}`}>
                      {STATUS_CONFIG[profileStatus as keyof typeof STATUS_CONFIG].label}
                    </span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 text-text3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Content */}
              {isExpanded && (
                <div className="border-t border-border-subtle p-3 space-y-2">
                  {[
                    { type: 'ebook' as const, material: ebook, icon: BookOpen, label: 'E-book' },
                    { type: 'playbook' as const, material: playbook, icon: FileText, label: 'Playbook' },
                  ].map(({ type, material, icon: Icon, label: typeLabel }) => (
                    <div key={type} className="flex items-center justify-between bg-bg3 rounded-lg p-2.5">
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-text3" />
                        <span className="text-[12px] text-text2">{typeLabel}</span>
                        {material?.word_count && (
                          <span className="text-[10px] text-text3">{material.word_count.toLocaleString()} palavras</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {material?.status === 'generating' && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-scribia-yellow" />
                        )}
                        {material?.status === 'completed' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(`/api/materials/${lectureId}?type=${type}&profile=${profile}`, '_blank')
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-purple-light hover:text-purple transition-colors cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            Abrir
                          </button>
                        )}
                        {material && (material.status === 'completed' || material.status === 'failed') && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteMaterial(material.id)
                            }}
                            disabled={deleting === material.id}
                            className="inline-flex items-center gap-1 text-[11px] text-text3 hover:text-scribia-red transition-colors cursor-pointer disabled:opacity-50"
                            title={`Excluir ${typeLabel}`}
                          >
                            {deleting === material.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                          </button>
                        )}
                        {material?.status === 'completed' && (
                          <CheckCircle className="w-3.5 h-3.5 text-scribia-green" />
                        )}
                        {material?.status === 'failed' && (
                          <AlertCircle className="w-3.5 h-3.5 text-scribia-red" />
                        )}
                        {!material && isSelected && (
                          <span className="text-[10px] text-text3">Aguardando</span>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Preview button for completed materials */}
                  {ebook?.status === 'completed' && ebook.markdown_content && (
                    <details className="mt-2">
                      <summary className="text-[11px] text-purple-light cursor-pointer hover:text-purple">
                        Preview do E-book
                      </summary>
                      <div className="mt-2 bg-bg1 border border-border-subtle rounded-lg p-3 max-h-48 overflow-y-auto">
                        <div className="text-[11px] text-text2 leading-relaxed whitespace-pre-wrap">
                          {ebook.markdown_content.substring(0, 1500)}
                          {ebook.markdown_content.length > 1500 && '...'}
                        </div>
                      </div>
                    </details>
                  )}

                  {/* Delete entire profile materials */}
                  {profileMaterials.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border-subtle">
                      <button
                        type="button"
                        onClick={() => deleteProfile(profile)}
                        disabled={deleting === profile}
                        className="inline-flex items-center gap-1.5 text-[11px] text-text3 hover:text-scribia-red transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {deleting === profile ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                        Excluir ebook e playbook deste perfil
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
