'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import {
  Save,
  RotateCcw,
  FileText,
  BookOpen,
  Image,
  Sparkles,
  Check,
  Loader2,
  Info,
} from 'lucide-react'

interface PromptData {
  id: string
  key: string
  name: string
  description: string | null
  prompt_text: string
  updated_at: string
}

interface Props {
  prompts: PromptData[]
}

const PROMPT_ICONS: Record<string, typeof FileText> = {
  summary: Sparkles,
  ebook: BookOpen,
  playbook: FileText,
  card_image: Image,
}

const PROMPT_VARIABLES: Record<string, string[]> = {
  summary: ['{{title}}', '{{transcript}}'],
  ebook: ['{{title}}', '{{speaker}}', '{{event}}', '{{summary}}', '{{topics}}', '{{transcript}}'],
  playbook: ['{{title}}', '{{speaker}}', '{{summary}}', '{{transcript}}'],
  card_image: ['{{title}}', '{{speaker}}', '{{summary}}'],
}

export function PromptEditor({ prompts }: Props) {
  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>(
    Object.fromEntries(prompts.map((p) => [p.id, p.prompt_text]))
  )
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(prompts[0]?.id ?? '')
  const router = useRouter()
  const supabase = createClient()

  const handleSave = async (prompt: PromptData) => {
    const newText = editedPrompts[prompt.id]
    if (newText === prompt.prompt_text) return

    setSaving(prompt.id)
    const { error } = await supabase
      .from('system_prompts')
      .update({ prompt_text: newText } as never)
      .eq('id', prompt.id)

    setSaving(null)
    if (!error) {
      setSaved(prompt.id)
      setTimeout(() => setSaved(null), 2000)
      router.refresh()
    }
  }

  const handleReset = (prompt: PromptData) => {
    setEditedPrompts((prev) => ({ ...prev, [prompt.id]: prompt.prompt_text }))
  }

  const isModified = (prompt: PromptData) => editedPrompts[prompt.id] !== prompt.prompt_text

  const activePrompt = prompts.find((p) => p.id === activeTab)

  return (
    <div className="flex gap-4">
      {/* Tab sidebar */}
      <div className="w-[200px] shrink-0 space-y-1">
        {prompts.map((prompt) => {
          const Icon = PROMPT_ICONS[prompt.key] ?? FileText
          const active = activeTab === prompt.id
          return (
            <button
              key={prompt.id}
              onClick={() => setActiveTab(prompt.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] transition-all text-left ${
                active
                  ? 'bg-purple-dim text-purple-light border border-border-purple'
                  : 'text-text2 hover:bg-bg3 hover:text-text border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0 opacity-80" />
              <span className="truncate">{prompt.name}</span>
              {isModified(prompt) && (
                <span className="ml-auto w-2 h-2 rounded-full bg-scribia-yellow shrink-0" />
              )}
            </button>
          )
        })}
      </div>

      {/* Editor panel */}
      {activePrompt && (
        <div className="flex-1 min-w-0">
          <div className="bg-bg2 border border-border-subtle rounded-2xl p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-heading text-[16px] font-bold text-text">
                  {activePrompt.name}
                </h2>
                {activePrompt.description && (
                  <p className="text-[12px] text-text3 mt-0.5">{activePrompt.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                {isModified(activePrompt) && (
                  <button
                    onClick={() => handleReset(activePrompt)}
                    className="inline-flex items-center gap-1.5 bg-bg3 border border-border-subtle text-text3 px-3 py-1.5 rounded-lg text-[11px] hover:text-text transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Desfazer
                  </button>
                )}
                <button
                  onClick={() => handleSave(activePrompt)}
                  disabled={!isModified(activePrompt) || saving === activePrompt.id}
                  className="inline-flex items-center gap-1.5 bg-purple text-white px-4 py-1.5 rounded-lg text-[11px] font-medium hover:bg-purple-light transition-all disabled:opacity-40 cursor-pointer"
                >
                  {saving === activePrompt.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : saved === activePrompt.id ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  {saved === activePrompt.id ? 'Salvo!' : 'Salvar'}
                </button>
              </div>
            </div>

            {/* Variables hint */}
            {PROMPT_VARIABLES[activePrompt.key] && (
              <div className="flex items-start gap-2 bg-purple-dim/30 border border-border-purple/20 rounded-xl px-4 py-3 mb-4">
                <Info className="w-3.5 h-3.5 text-purple-light mt-0.5 shrink-0" />
                <div>
                  <span className="text-[11px] text-text3">Variáveis disponíveis: </span>
                  {PROMPT_VARIABLES[activePrompt.key].map((v, i) => (
                    <code
                      key={i}
                      className="inline-block bg-bg3 border border-border-subtle rounded px-1.5 py-0.5 text-[10px] text-purple-light font-mono mr-1 mb-1"
                    >
                      {v}
                    </code>
                  ))}
                </div>
              </div>
            )}

            {/* Textarea */}
            <textarea
              value={editedPrompts[activePrompt.id] ?? ''}
              onChange={(e) =>
                setEditedPrompts((prev) => ({
                  ...prev,
                  [activePrompt.id]: e.target.value,
                }))
              }
              rows={18}
              className="w-full bg-bg3 border border-border-subtle rounded-xl px-4 py-3 text-[13px] text-text2 font-mono leading-relaxed resize-y focus:outline-none focus:border-border-purple focus:ring-1 focus:ring-purple/20 transition-all placeholder:text-text3"
              placeholder="Digite o prompt aqui..."
              spellCheck={false}
            />

            {/* Footer */}
            <div className="flex items-center justify-between mt-3">
              <span className="text-[10px] text-text3">
                Última atualização: {new Date(activePrompt.updated_at).toLocaleString('pt-BR')}
              </span>
              <span className="text-[10px] text-text3">
                {(editedPrompts[activePrompt.id] ?? '').length} caracteres
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
