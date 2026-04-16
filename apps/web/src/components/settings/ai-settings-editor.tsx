'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import {
  Save,
  Check,
  Loader2,
  Eye,
  EyeOff,
  Cpu,
  Key,
  Zap,
} from 'lucide-react'

interface AiSettings {
  id: string
  provider: string
  api_key: string
  model: string
  updated_at: string
}

interface Props {
  settings: AiSettings
}

const PROVIDERS = [
  {
    value: 'gemini',
    label: 'Google Gemini',
    color: 'text-blue-400',
    models: [
      { value: 'gemini-3.0-flash', label: 'Gemini 3.0 Flash' },
      { value: 'gemini-3.0-pro', label: 'Gemini 3.0 Pro' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    ],
  },
  {
    value: 'anthropic',
    label: 'Anthropic (Claude)',
    color: 'text-orange-400',
    models: [
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
      { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    ],
  },
  {
    value: 'openai',
    label: 'OpenAI',
    color: 'text-green-400',
    models: [
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'gpt-4.1', label: 'GPT-4.1' },
      { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    ],
  },
]

export function AiSettingsEditor({ settings }: Props) {
  const [provider, setProvider] = useState(settings.provider)
  const [apiKey, setApiKey] = useState(settings.api_key)
  const [model, setModel] = useState(settings.model)
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const currentProvider = PROVIDERS.find((p) => p.value === provider)
  const isModified =
    provider !== settings.provider ||
    apiKey !== settings.api_key ||
    model !== settings.model

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider)
    const providerDef = PROVIDERS.find((p) => p.value === newProvider)
    if (providerDef?.models[0]) {
      setModel(providerDef.models[0].value)
    }
  }

  const handleSave = async () => {
    if (!isModified) return
    setSaving(true)

    const { error } = await supabase
      .from('ai_settings')
      .update({ provider, api_key: apiKey, model } as never)
      .eq('id', settings.id)

    setSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    }
  }

  const maskKey = (key: string) => {
    if (!key) return ''
    if (key.length <= 8) return '****'
    return key.slice(0, 4) + '*'.repeat(key.length - 8) + key.slice(-4)
  }

  return (
    <div className="space-y-6">
      {/* Provider Selection */}
      <div className="bg-bg2 border border-border-subtle rounded-2xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="w-4 h-4 text-purple-light" />
          <h2 className="font-heading text-[16px] font-bold text-text">
            Provedor de IA
          </h2>
        </div>
        <p className="text-[12px] text-text3 mb-4">
          Selecione o provedor que sera usado para gerar resumos, e-books e playbooks.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PROVIDERS.map((p) => (
            <button
              key={p.value}
              onClick={() => handleProviderChange(p.value)}
              className={`flex flex-col items-center gap-2 px-4 py-4 rounded-xl border text-[13px] transition-all cursor-pointer ${
                provider === p.value
                  ? 'bg-purple-dim border-border-purple text-purple-light'
                  : 'bg-bg3 border-border-subtle text-text2 hover:bg-bg3/80 hover:text-text'
              }`}
            >
              <Zap className={`w-5 h-5 ${provider === p.value ? 'text-purple-light' : p.color}`} />
              <span className="font-medium">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* API Key */}
      <div className="bg-bg2 border border-border-subtle rounded-2xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-4 h-4 text-purple-light" />
          <h2 className="font-heading text-[16px] font-bold text-text">
            Chave de API
          </h2>
        </div>
        <p className="text-[12px] text-text3 mb-4">
          Insira a chave de API do provedor selecionado. A chave e armazenada de forma segura no banco de dados.
        </p>

        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={showKey ? apiKey : apiKey ? maskKey(apiKey) : ''}
            onChange={(e) => {
              if (showKey) setApiKey(e.target.value)
            }}
            onFocus={() => setShowKey(true)}
            placeholder={`Insira sua ${currentProvider?.label ?? ''} API Key...`}
            className="w-full bg-bg3 border border-border-subtle rounded-xl px-4 py-3 pr-12 text-[13px] text-text2 font-mono focus:outline-none focus:border-border-purple focus:ring-1 focus:ring-purple/20 transition-all placeholder:text-text3"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text3 hover:text-text transition-colors cursor-pointer"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {!apiKey && (
          <p className="text-[11px] text-scribia-yellow mt-2">
            Nenhuma chave configurada. A geracao de materiais nao funcionara sem uma chave valida.
          </p>
        )}
      </div>

      {/* Model Selection */}
      <div className="bg-bg2 border border-border-subtle rounded-2xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-purple-light" />
          <h2 className="font-heading text-[16px] font-bold text-text">
            Modelo
          </h2>
        </div>
        <p className="text-[12px] text-text3 mb-4">
          Escolha o modelo de IA para geracao de conteudo. Modelos mais avancados geram conteudo de maior qualidade, mas podem ser mais lentos e caros.
        </p>

        <div className="space-y-2">
          {currentProvider?.models.map((m) => (
            <button
              key={m.value}
              onClick={() => setModel(m.value)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-[13px] transition-all cursor-pointer ${
                model === m.value
                  ? 'bg-purple-dim border-border-purple text-purple-light'
                  : 'bg-bg3 border-border-subtle text-text2 hover:bg-bg3/80 hover:text-text'
              }`}
            >
              <span className="font-medium">{m.label}</span>
              <code className="text-[11px] text-text3 font-mono">{m.value}</code>
            </button>
          ))}
        </div>
      </div>

      {/* Save Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-bg2 border border-border-subtle rounded-2xl px-4 sm:px-6 py-4">
        <span className="text-[11px] text-text3">
          Ultima atualizacao: {new Date(settings.updated_at).toLocaleString('pt-BR')}
        </span>
        <button
          onClick={handleSave}
          disabled={!isModified || saving}
          className="inline-flex items-center gap-2 bg-purple text-white px-5 sm:px-6 py-2.5 rounded-xl text-[13px] font-medium hover:bg-purple-light transition-all disabled:opacity-40 cursor-pointer"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? 'Salvo!' : 'Salvar configuracoes'}
        </button>
      </div>
    </div>
  )
}
