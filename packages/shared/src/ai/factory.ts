import type { AIProvider } from './types'

function getEnvVar(name: string): string | undefined {
  // Support both Node.js and Deno environments
  if (typeof process !== 'undefined' && process.env) {
    return process.env[name]
  }
  try {
    // @ts-expect-error Deno global
    return Deno.env.get(name)
  } catch {
    return undefined
  }
}

export async function createAIProvider(): Promise<AIProvider> {
  const provider = getEnvVar('AI_PROVIDER') || 'gemini'

  switch (provider) {
    case 'gemini': {
      const { GeminiProvider } = await import('./providers/gemini')
      return new GeminiProvider()
    }
    case 'claude': {
      const { ClaudeProvider } = await import('./providers/claude')
      return new ClaudeProvider()
    }
    default:
      throw new Error(`Unknown AI provider: ${provider}. Supported: gemini, claude`)
  }
}
