// Markdown parser — converts AI-generated markdown into structured document sections
// Used by pdf-generator to render each section type with appropriate formatting

export type SectionType = 'h1' | 'h2' | 'h3' | 'paragraph' | 'bullet' | 'numbered' | 'blockquote' | 'divider' | 'checkbox'

export interface DocSection {
  type: SectionType
  text: string
  items?: string[] // for lists
  checked?: boolean[] // for checkboxes
}

/**
 * Parse markdown text into structured document sections.
 * Handles: headings (h1-h3), paragraphs, bullet/numbered lists,
 * blockquotes, horizontal rules, and checkbox lists.
 */
export function parseMarkdown(markdown: string): DocSection[] {
  const sections: DocSection[] = []
  const lines = markdown.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Skip empty lines
    if (!trimmed) {
      i++
      continue
    }

    // Skip HTML comments (image placeholders)
    if (trimmed.startsWith('<!--') && trimmed.endsWith('-->')) {
      i++
      continue
    }

    // Skip markdown images
    if (trimmed.startsWith('![')) {
      i++
      continue
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      sections.push({ type: 'divider', text: '' })
      i++
      continue
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3
      const type = `h${level}` as SectionType
      sections.push({ type, text: headingMatch[2] })
      i++
      continue
    }

    // Checkbox list (- [ ] or - [x])
    if (/^[-*]\s+\[[ xX]\]/.test(trimmed)) {
      const items: string[] = []
      const checked: boolean[] = []
      while (i < lines.length) {
        const checkMatch = lines[i].trim().match(/^[-*]\s+\[([ xX])\]\s*(.*)/)
        if (!checkMatch) break
        checked.push(checkMatch[1].toLowerCase() === 'x')
        items.push(checkMatch[2])
        i++
      }
      sections.push({ type: 'checkbox', text: '', items, checked })
      continue
    }

    // Bullet list
    if (/^[-*+]\s+/.test(trimmed) && !/^[-*+]\s+\[/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length) {
        const bulletMatch = lines[i].trim().match(/^[-*+]\s+(.*)/)
        if (!bulletMatch) break
        items.push(bulletMatch[1])
        i++
      }
      sections.push({ type: 'bullet', text: '', items })
      continue
    }

    // Numbered list
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length) {
        const numMatch = lines[i].trim().match(/^\d+[.)]\s+(.*)/)
        if (!numMatch) break
        items.push(numMatch[1])
        i++
      }
      sections.push({ type: 'numbered', text: '', items })
      continue
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s*/, ''))
        i++
      }
      sections.push({ type: 'blockquote', text: quoteLines.join(' ') })
      continue
    }

    // Regular paragraph — collect consecutive non-empty, non-special lines
    const paraLines: string[] = []
    while (i < lines.length) {
      const pLine = lines[i].trim()
      if (!pLine) break
      if (pLine.startsWith('#') || pLine.startsWith('>') || pLine.startsWith('- ') ||
          pLine.startsWith('* ') || pLine.startsWith('+ ') || /^\d+[.)]\s/.test(pLine) ||
          /^(-{3,}|\*{3,}|_{3,})$/.test(pLine) || pLine.startsWith('<!--') || pLine.startsWith('![')) {
        break
      }
      paraLines.push(pLine)
      i++
    }
    if (paraLines.length > 0) {
      sections.push({ type: 'paragraph', text: paraLines.join(' ') })
    }
  }

  return sections
}

/**
 * Extract chapter titles (h2 headings) from parsed sections.
 * Used for table of contents generation.
 */
export function extractChapterTitles(sections: DocSection[]): string[] {
  return sections
    .filter(s => s.type === 'h2')
    .map(s => s.text)
}
