import type { ZodSchema } from 'zod'

export interface GenerateOptions {
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

export interface AIProvider {
  readonly name: string
  generateContent(prompt: string, options?: GenerateOptions): Promise<string>
  generateStructured<T>(prompt: string, schema: ZodSchema<T>, options?: GenerateOptions): Promise<T>
}
