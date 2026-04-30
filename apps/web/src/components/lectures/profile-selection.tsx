'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import {
  ChevronDown,
  ChevronUp,
  Info,
  List,
  AlignLeft,
  Check,
} from 'lucide-react'

const PROFILE_LABELS: Record<string, { label: string; desc: string }> = {
  junior_compact: {
    label: 'Junior Compacto',
    desc: 'Estudante iniciante. ~3500 palavras, tópicos, glossário.',
  },
  junior_complete: {
    label: 'Junior Completo',
    desc: 'Estudante. ~7000 palavras, glossário, linha do tempo, mapa de conexões.',
  },
  pleno_compact: {
    label: 'Pleno Compacto',
    desc: 'Profissional 2-5 anos. ~3500 palavras, insights práticos.',
  },
  pleno_complete: {
    label: 'Pleno Completo',
    desc: 'Profissional 2-5 anos. ~7000 palavras, frameworks, comparativos.',
  },
  senior_compact: {
    label: 'Senior Compacto',
    desc: 'Especialista 5+ anos. ~3500 palavras, nuances estratégicas.',
  },
  senior_complete: {
    label: 'Senior Completo',
    desc: 'Especialista/pesquisador. ~7000 palavras, análise epistemológica.',
  },
}

const ROWS = [
  { level: 'Junior', compact: 'junior_compact', complete: 'junior_complete' },
  { level: 'Pleno', compact: 'pleno_compact', complete: 'pleno_complete' },
  { level: 'Senior', compact: 'senior_compact', complete: 'senior_complete' },
]

const DEFAULT_PROFILES = ['junior_complete', 'pleno_complete']

interface GenerationConfig {
  id?: string
  lecture_id: string
  selected_profiles: string[]
  content_format: 'topics' | 'developed'
  include_glossary: boolean
  include_timeline: boolean
  include_quiz: boolean
  include_connection_map: boolean
}

interface Props {
  lectureId: string
  eventId: string
  disabled?: boolean
  onProfilesLoaded?: (profiles: string[]) => void
}

export function ProfileSelection({ lectureId, eventId, disabled = false, onProfilesLoaded }: Props) {
  const [config, setConfig] = useState<GenerationConfig>({
    lecture_id: lectureId,
    selected_profiles: DEFAULT_PROFILES,
    content_format: 'developed',
    include_glossary: true,
    include_timeline: true,
    include_quiz: false,
    include_connection_map: false,
  })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const supabase = createClient()

  // Load existing config
  useEffect(() => {
    async function load() {
      // Try lecture-specific config first
      const { data: raw } = await supabase
        .from('generation_configs' as never)
        .select('*')
        .eq('lecture_id', lectureId)
        .single()

      const lectureConfig = raw as Record<string, unknown> | null
      if (lectureConfig) {
        const profiles = (lectureConfig.selected_profiles as string[]) || DEFAULT_PROFILES
        setConfig({
          id: lectureConfig.id as string,
          lecture_id: lectureId,
          selected_profiles: profiles,
          content_format: lectureConfig.content_format as 'topics' | 'developed',
          include_glossary: lectureConfig.include_glossary as boolean,
          include_timeline: lectureConfig.include_timeline as boolean,
          include_quiz: lectureConfig.include_quiz as boolean,
          include_connection_map: lectureConfig.include_connection_map as boolean,
        })
        // Notify parent after state update, deferred to avoid setState-during-render
        setTimeout(() => onProfilesLoaded?.(profiles), 0)
      } else {
        // No config in DB — notify parent with default profiles
        setTimeout(() => onProfilesLoaded?.(DEFAULT_PROFILES), 0)
      }
      setLoaded(true)
    }
    load()
  }, [lectureId, supabase])

  const toggleProfile = useCallback((profile: string) => {
    if (disabled) return
    setConfig(prev => {
      const profiles = prev.selected_profiles.includes(profile)
        ? prev.selected_profiles.filter(p => p !== profile)
        : [...prev.selected_profiles, profile]
      // Deferred to avoid setState-during-render
      setTimeout(() => onProfilesLoaded?.(profiles), 0)
      return { ...prev, selected_profiles: profiles }
    })
  }, [disabled, onProfilesLoaded])

  const updateConfig = useCallback(<K extends keyof GenerationConfig>(key: K, value: GenerationConfig[K]) => {
    if (disabled) return
    setConfig(prev => ({ ...prev, [key]: value }))
  }, [disabled])

  // Save config to DB
  const saveConfig = useCallback(async () => {
    const payload = {
      lecture_id: lectureId,
      selected_profiles: config.selected_profiles,
      content_format: config.content_format,
      include_glossary: config.include_glossary,
      include_timeline: config.include_timeline,
      include_quiz: config.include_quiz,
      include_connection_map: config.include_connection_map,
    }

    if (config.id) {
      await supabase
        .from('generation_configs' as never)
        .update(payload as never)
        .eq('id', config.id)
    } else {
      const { data } = await supabase
        .from('generation_configs' as never)
        .insert(payload as never)
        .select('id')
        .single()
      const row = data as { id: string } | null
      if (row) {
        setConfig(prev => ({ ...prev, id: row.id }))
      }
    }
  }, [config, lectureId, supabase])

  // Auto-save on change (debounced)
  useEffect(() => {
    if (!loaded) return
    const timer = setTimeout(() => { saveConfig() }, 500)
    return () => clearTimeout(timer)
  }, [config.selected_profiles, config.content_format, config.include_glossary, config.include_timeline, config.include_quiz, config.include_connection_map, loaded, saveConfig])

  const selectedCount = config.selected_profiles.length

  if (!loaded) return null

  return (
    <div>

      {/* Profile grid */}
      <div className="mb-5">
        <div className="text-[12px] text-text3 mb-2.5 font-medium">Perfis de Livebook</div>
        <div className="border border-border-subtle rounded-xl">
          {/* Header */}
          <div className="grid grid-cols-3 bg-bg3 rounded-t-xl">
            <div className="p-2.5 text-[11px] text-text3 uppercase tracking-wider" />
            <div className="p-2.5 text-[11px] text-text3 uppercase tracking-wider text-center border-l border-border-subtle">
              Compacto
            </div>
            <div className="p-2.5 text-[11px] text-text3 uppercase tracking-wider text-center border-l border-border-subtle">
              Completo
            </div>
          </div>
          {/* Rows */}
          {ROWS.map((row, rowIdx) => (
            <div key={row.level} className="grid grid-cols-3 border-t border-border-subtle">
              <div className="p-2.5 text-[12px] text-text font-medium flex items-center">
                {row.level}
              </div>
              {[row.compact, row.complete].map((profile, colIdx) => {
                const selected = config.selected_profiles.includes(profile)
                const isLast = rowIdx === ROWS.length - 1
                return (
                  <button
                    key={profile}
                    type="button"
                    onClick={() => toggleProfile(profile)}
                    disabled={disabled}
                    title={PROFILE_LABELS[profile].desc}
                    className={`p-2.5 border-l border-border-subtle flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed group ${
                      selected
                        ? 'bg-purple/8'
                        : 'hover:bg-bg3'
                    } ${isLast && colIdx === 1 ? 'rounded-br-xl' : ''}`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      selected
                        ? 'bg-purple border-purple text-white scale-110'
                        : 'border-border-subtle group-hover:border-purple/50'
                    }`}>
                      {selected && <Check className="w-3 h-3" strokeWidth={3} />}
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        {selectedCount === 0 && (
          <p className="text-[11px] text-scribia-red mt-2">Selecione pelo menos 1 perfil para gerar.</p>
        )}
      </div>

      {/* Content format */}
      <div className="mb-5">
        <div className="text-[12px] text-text3 mb-2.5 font-medium">Formato do Conteudo</div>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { value: 'topics' as const, label: 'Em topicos', desc: 'Bullet points, tabelas resumidas', icon: List },
            { value: 'developed' as const, label: 'Desenvolvido', desc: 'Texto corrido, analise profunda', icon: AlignLeft },
          ].map(opt => {
            const Icon = opt.icon
            const isActive = config.content_format === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateConfig('content_format', opt.value)}
                disabled={disabled}
                className={`flex items-start gap-2.5 p-3 rounded-xl text-left transition-all cursor-pointer disabled:cursor-not-allowed ${
                  isActive
                    ? 'bg-purple/10 border-2 border-purple/40'
                    : 'bg-bg3 border-2 border-transparent hover:border-border-subtle'
                }`}
              >
                <div className={`mt-0.5 shrink-0 ${isActive ? 'text-purple' : 'text-text3'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className={`text-[12px] font-medium ${isActive ? 'text-purple' : 'text-text2'}`}>{opt.label}</div>
                  <div className={`text-[10px] mt-0.5 ${isActive ? 'text-purple/70' : 'text-text3'}`}>{opt.desc}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Advanced toggles */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-[12px] text-text3 hover:text-text2 transition-colors cursor-pointer"
        >
          {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Opcoes avancadas
        </button>
        {showAdvanced && (
          <div className="mt-3 space-y-2 pl-1">
            {[
              { key: 'include_glossary' as const, label: 'Incluir glossario', hint: 'Padrao para perfis Junior' },
              { key: 'include_timeline' as const, label: 'Incluir linha do tempo', hint: 'Marcos cronologicos da palestra' },
              { key: 'include_quiz' as const, label: 'Incluir quiz', hint: 'Perguntas de revisao ao final' },
              { key: 'include_connection_map' as const, label: 'Incluir mapa de conexoes', hint: 'Relacoes entre topicos' },
            ].map(toggle => (
              <label key={toggle.key} className="flex items-start gap-2.5 cursor-pointer group py-1">
                <button
                  type="button"
                  onClick={() => updateConfig(toggle.key, !config[toggle.key])}
                  disabled={disabled}
                  className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer disabled:cursor-not-allowed ${
                    config[toggle.key]
                      ? 'bg-purple border-purple text-white'
                      : 'border-border-subtle group-hover:border-purple/50'
                  }`}
                >
                  {config[toggle.key] && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                </button>
                <div>
                  <div className="text-[12px] text-text2">{toggle.label}</div>
                  <div className="text-[10px] text-text3">{toggle.hint}</div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export { PROFILE_LABELS, DEFAULT_PROFILES }
export type { GenerationConfig }
