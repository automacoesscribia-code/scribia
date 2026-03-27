// Text sanitization for pdf-lib WinAnsi encoding compatibility
// WinAnsi (Windows-1252) supports: Basic Latin, Latin-1 Supplement, and select typographic chars
// Portuguese characters (ã, é, ç, ô, etc.) ARE supported
// Emojis and chars outside Windows-1252 CRASH pdf-lib — must be stripped

// Windows-1252 extra codepoints (0x80-0x9F mapped characters)
const WIN1252_EXTRAS = new Set([
  0x20ac, // €
  0x201a, // ‚
  0x0192, // ƒ
  0x201e, // „
  0x2026, // …
  0x2020, // †
  0x2021, // ‡
  0x02c6, // ˆ
  0x2030, // ‰
  0x0160, // Š
  0x2039, // ‹
  0x0152, // Œ
  0x017d, // Ž
  0x2018, // '
  0x2019, // '
  0x201c, // "
  0x201d, // "
  0x2022, // •
  0x2013, // –
  0x2014, // —
  0x02dc, // ˜
  0x2122, // ™
  0x0161, // š
  0x203a, // ›
  0x0153, // œ
  0x017e, // ž
  0x0178, // Ÿ
])

function isWinAnsiChar(code: number): boolean {
  // Control chars we want to keep
  if (code === 0x09 || code === 0x0a || code === 0x0d) return true
  // Basic ASCII printable (space through ~)
  if (code >= 0x20 && code <= 0x7e) return true
  // Latin-1 Supplement (non-breaking space through ÿ) — includes all Portuguese chars
  if (code >= 0xa0 && code <= 0xff) return true
  // Windows-1252 extra typographic characters
  return WIN1252_EXTRAS.has(code)
}

/**
 * Sanitize text for safe rendering with pdf-lib Helvetica (WinAnsi encoding).
 * - Strips emojis (supplementary plane characters U+10000+)
 * - Strips chars not in Windows-1252
 * - Preserves all Portuguese characters (ã, é, ç, ô, ú, í, etc.)
 * - Preserves smart quotes, em dashes, bullets, etc.
 */
export function sanitizeForPdf(text: string): string {
  let result = ''
  for (const char of text) {
    const code = char.codePointAt(0)!
    // Skip supplementary plane chars (emojis, symbols > U+FFFF)
    if (code > 0xffff) continue
    // Skip zero-width and variation selectors
    if (code === 0x200b || code === 0x200c || code === 0x200d || code === 0xfeff) continue
    if (code >= 0xfe00 && code <= 0xfe0f) continue
    // Keep if WinAnsi compatible
    if (isWinAnsiChar(code)) {
      result += char
    }
    // else silently drop
  }
  return result
}

/**
 * Strip markdown formatting while preserving text content.
 * Returns plain text suitable for PDF rendering.
 */
export function stripMarkdownInline(text: string): string {
  return text
    // Remove bold/italic markers
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/___(.+?)___/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove links, keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Remove HTML comments (image placeholders)
    .replace(/<!--.*?-->/g, '')
    .trim()
}

/**
 * Detect bold segments in a line of text.
 * Returns array of { text, bold } segments.
 */
export interface TextSegment {
  text: string
  bold: boolean
}

export function parseInlineFormatting(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  const regex = /\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    // Text before bold
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index)
      if (before) segments.push({ text: stripMarkdownInline(before), bold: false })
    }
    // Bold text
    segments.push({ text: match[1], bold: true })
    lastIndex = match.index + match[0].length
  }

  // Remaining text
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex)
    if (remaining.trim()) segments.push({ text: stripMarkdownInline(remaining), bold: false })
  }

  if (segments.length === 0) {
    segments.push({ text: stripMarkdownInline(text), bold: false })
  }

  return segments
}
