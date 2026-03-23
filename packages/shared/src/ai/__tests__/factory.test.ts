import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('createAIProvider', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('defaults to gemini when AI_PROVIDER is not set', async () => {
    vi.stubEnv('AI_PROVIDER', '')
    vi.stubEnv('GEMINI_API_KEY', 'test-key')

    const { createAIProvider } = await import('../factory')
    const provider = await createAIProvider()
    expect(provider.name).toBe('gemini')
  })

  it('creates claude provider when AI_PROVIDER=claude', async () => {
    vi.stubEnv('AI_PROVIDER', 'claude')
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')

    const { createAIProvider } = await import('../factory')
    const provider = await createAIProvider()
    expect(provider.name).toBe('claude')
  })

  it('throws on unknown provider', async () => {
    vi.stubEnv('AI_PROVIDER', 'openai')

    const { createAIProvider } = await import('../factory')
    await expect(createAIProvider()).rejects.toThrow('Unknown AI provider: openai')
  })
})
