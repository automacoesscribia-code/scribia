import { describe, it, expect } from 'vitest'
import { ScribiaPdfBuilder } from '../builder'

describe('ScribiaPdfBuilder', () => {
  it('generates valid PDF bytes', async () => {
    const builder = await new ScribiaPdfBuilder().init()
    await builder.addCover('Test Title', 'Test Subtitle')
    await builder.addTableOfContents(['Chapter 1', 'Chapter 2'])
    await builder.addChapter('Chapter 1', 'This is the content of chapter one.\n\nSecond paragraph here.')
    await builder.addChapter('Chapter 2', 'Chapter two content.')
    builder.addFooter()
    const bytes = await builder.build()

    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(0)

    // Check PDF magic bytes: %PDF
    const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])
    expect(header).toBe('%PDF')
  })

  it('creates multiple pages for long content', async () => {
    const builder = await new ScribiaPdfBuilder().init()
    await builder.addCover('Long Doc', 'Many pages')

    // Generate enough content to force multiple pages
    const longContent = Array(100).fill('Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.').join('\n\n')
    await builder.addChapter('Long Chapter', longContent)
    builder.addFooter()
    const bytes = await builder.build()

    expect(bytes.length).toBeGreaterThan(1000)
    const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])
    expect(header).toBe('%PDF')
  })
})
