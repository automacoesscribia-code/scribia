import { describe, it, expect } from 'vitest'
import { ScribiaDocxBuilder } from '../builder'

describe('ScribiaDocxBuilder', () => {
  it('generates valid DOCX buffer', async () => {
    const builder = new ScribiaDocxBuilder()
    builder.addCover('Test Title', 'Test Subtitle')
    builder.addChapter('Chapter 1', 'Content of chapter one.\n\nSecond paragraph.')
    builder.addBulletList(['Item A', 'Item B', 'Item C'])
    builder.addChapter('Chapter 2', 'Content of chapter two.')
    const buffer = await builder.build()

    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)

    // Check ZIP magic bytes (DOCX is a ZIP): PK\x03\x04
    expect(buffer[0]).toBe(0x50) // P
    expect(buffer[1]).toBe(0x4b) // K
  })

  it('supports numbered lists', async () => {
    const builder = new ScribiaDocxBuilder()
    builder.addHeading('Numbered Section')
    builder.addNumberedList(['First', 'Second', 'Third'])
    const buffer = await builder.build()

    expect(buffer[0]).toBe(0x50)
    expect(buffer[1]).toBe(0x4b)
  })
})
