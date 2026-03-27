// Shared AI provider — reads config from ai_settings table, falls back to env vars

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface AiConfig {
  provider: 'gemini' | 'openai' | 'anthropic'
  apiKey: string
  model: string
}

const PROVIDER_MODELS: Record<string, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-6',
}

async function getAiConfig(): Promise<AiConfig> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data } = await supabase
    .from('ai_settings')
    .select('provider, api_key, model')
    .limit(1)
    .single()

  if (data?.api_key) {
    return {
      provider: data.provider as AiConfig['provider'],
      apiKey: data.api_key,
      model: data.model || PROVIDER_MODELS[data.provider] || 'gemini-2.5-flash',
    }
  }

  // Fallback to env vars
  const provider = (Deno.env.get('AI_PROVIDER') || 'gemini') as AiConfig['provider']
  const apiKey = provider === 'gemini'
    ? Deno.env.get('GEMINI_API_KEY') ?? ''
    : provider === 'anthropic'
      ? Deno.env.get('ANTHROPIC_API_KEY') ?? ''
      : Deno.env.get('OPENAI_API_KEY') ?? ''

  return {
    provider,
    apiKey,
    model: PROVIDER_MODELS[provider] || 'gemini-2.5-flash',
  }
}

export async function callAIProvider(
  prompt: string,
  options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean },
): Promise<string> {
  const config = await getAiConfig()
  if (!config.apiKey) throw new Error(`Missing API key for provider: ${config.provider}`)

  const temperature = options?.temperature ?? 0.7
  const maxTokens = options?.maxTokens ?? 8192

  if (config.provider === 'gemini') {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
            ...(options?.jsonMode ? { responseMimeType: 'application/json' } : {}),
          },
        }),
      },
    )
    const data = await res.json()
    if (!res.ok) throw new Error(`Gemini API error: ${JSON.stringify(data)}`)
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  }

  if (config.provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Anthropic API error: ${JSON.stringify(data)}`)
    return data.content?.[0]?.text ?? ''
  }

  if (config.provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: 'user', content: prompt }],
        ...(options?.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`OpenAI API error: ${JSON.stringify(data)}`)
    return data.choices?.[0]?.message?.content ?? ''
  }

  throw new Error(`Unknown AI provider: ${config.provider}`)
}
