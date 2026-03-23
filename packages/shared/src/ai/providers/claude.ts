import Anthropic from '@anthropic-ai/sdk'
import type { ZodSchema } from 'zod'
import type { AIProvider, GenerateOptions } from '../types'

export class ClaudeProvider implements AIProvider {
  readonly name = 'claude'
  private client: Anthropic

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('Missing ANTHROPIC_API_KEY environment variable')
    }
    this.client = new Anthropic({ apiKey })
  }

  async generateContent(prompt: string, options?: GenerateOptions): Promise<string> {
    const model = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6'

    const message = await this.client.messages.create({
      model,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      system: options?.systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    })

    const block = message.content[0]
    if (block.type !== 'text') {
      throw new Error(`Unexpected response type: ${block.type}`)
    }
    return block.text
  }

  async generateStructured<T>(
    prompt: string,
    schema: ZodSchema<T>,
    options?: GenerateOptions,
  ): Promise<T> {
    const text = await this.generateContent(
      `${prompt}\n\nResponda APENAS com JSON válido, sem markdown ou texto adicional.`,
      { ...options, temperature: options?.temperature ?? 0.3 },
    )

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text]
    const jsonStr = (jsonMatch[1] ?? text).trim()
    const parsed = JSON.parse(jsonStr)
    return schema.parse(parsed)
  }
}
