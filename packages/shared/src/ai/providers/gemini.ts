import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ZodSchema } from 'zod'
import type { AIProvider, GenerateOptions } from '../types'

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini'
  private client: GoogleGenerativeAI

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('Missing GEMINI_API_KEY environment variable')
    }
    this.client = new GoogleGenerativeAI(apiKey)
  }

  async generateContent(prompt: string, options?: GenerateOptions): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: options?.systemPrompt,
    })

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0.7,
      },
    })

    return result.response.text()
  }

  async generateStructured<T>(
    prompt: string,
    schema: ZodSchema<T>,
    options?: GenerateOptions,
  ): Promise<T> {
    const model = this.client.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: options?.systemPrompt,
    })

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${prompt}\n\nResponda APENAS com JSON válido, sem markdown ou texto adicional.`,
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0.3,
        responseMimeType: 'application/json',
      },
    })

    const text = result.response.text()
    const parsed = JSON.parse(text)
    return schema.parse(parsed)
  }
}
