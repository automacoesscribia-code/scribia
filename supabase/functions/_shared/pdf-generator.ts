// ScribIA PDF Generator — Deno-compatible, full UTF-8 support
// Uses pdf-lib with fontkit for custom font embedding (Unicode)
// Falls back to Helvetica + text sanitization if font loading fails

import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'https://esm.sh/pdf-lib@1.17.1'
import fontkit from 'https://esm.sh/@pdf-lib/fontkit@1.1.1'
import { sanitizeForPdf, stripMarkdownInline, parseInlineFormatting } from './text-sanitizer.ts'
import { parseMarkdown, extractChapterTitles, type DocSection } from './markdown-parser.ts'

// ─── Design Tokens ───

const COLORS = {
  dark: rgb(0.039, 0.039, 0.059),       // #0A0A0F
  darkBg: rgb(0.067, 0.067, 0.094),     // #111118
  purple: rgb(0.420, 0.306, 1.0),       // #6B4EFF
  purpleLight: rgb(0.545, 0.443, 1.0),  // #8B71FF
  green: rgb(0, 0.831, 0.627),          // #00D4A0
  text: rgb(0.1, 0.1, 0.1),            // body text
  textLight: rgb(0.4, 0.4, 0.45),      // secondary text
  textMuted: rgb(0.6, 0.6, 0.65),      // muted text
  white: rgb(1, 1, 1),
  quoteBg: rgb(0.96, 0.96, 0.98),      // light quote background
  divider: rgb(0.85, 0.85, 0.88),
}

const PAGE_W = 595 // A4 width in points
const PAGE_H = 842 // A4 height in points
const MARGIN = 50
const MARGIN_RIGHT = 50
const CONTENT_W = PAGE_W - MARGIN - MARGIN_RIGHT
const LINE_H = 16
const PARA_SPACING = 10

// ─── Font Loading ───

// Module-level font cache (persists across invocations in same Deno isolate)
let _fontCache: { regular: ArrayBuffer; bold: ArrayBuffer } | null = null

const FONT_URLS = {
  // Inter font from fontsource (WOFF format — supported by fontkit)
  regular: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.1.1/files/inter-latin-400-normal.woff',
  bold: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.1.1/files/inter-latin-700-normal.woff',
}

async function fetchFontBytes(): Promise<{ regular: ArrayBuffer; bold: ArrayBuffer } | null> {
  if (_fontCache) return _fontCache

  try {
    const [regularRes, boldRes] = await Promise.all([
      fetch(FONT_URLS.regular),
      fetch(FONT_URLS.bold),
    ])
    if (regularRes.ok && boldRes.ok) {
      _fontCache = {
        regular: await regularRes.arrayBuffer(),
        bold: await boldRes.arrayBuffer(),
      }
      return _fontCache
    }
  } catch (e) {
    console.warn('Font fetch failed, falling back to Helvetica:', e)
  }
  return null
}

// ─── PDF Generator ───

export interface PdfGeneratorOptions {
  title: string
  subtitle: string // e.g. "por Nome do Palestrante"
  event?: string
  type?: 'ebook' | 'playbook'
}

export async function generatePdfFromMarkdown(
  markdown: string,
  options: PdfGeneratorOptions,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()

  // Try to load custom font for full Unicode support
  let font: PDFFont
  let boldFont: PDFFont
  let useCustomFont = false

  const fontBytes = await fetchFontBytes()
  if (fontBytes) {
    try {
      doc.registerFontkit(fontkit)
      font = await doc.embedFont(fontBytes.regular)
      boldFont = await doc.embedFont(fontBytes.bold)
      useCustomFont = true
    } catch (e) {
      console.warn('Custom font embedding failed, using Helvetica:', e)
      font = await doc.embedFont(StandardFonts.Helvetica)
      boldFont = await doc.embedFont(StandardFonts.HelveticaBold)
    }
  } else {
    font = await doc.embedFont(StandardFonts.Helvetica)
    boldFont = await doc.embedFont(StandardFonts.HelveticaBold)
  }

  // If using Helvetica, sanitize all text
  const safe = (text: string): string => {
    const stripped = stripMarkdownInline(text)
    return useCustomFont ? stripped : sanitizeForPdf(stripped)
  }

  const safeRaw = (text: string): string => {
    return useCustomFont ? text : sanitizeForPdf(text)
  }

  // Page state
  const pages: PDFPage[] = []
  let page: PDFPage
  let y: number

  function newPage(): PDFPage {
    const p = doc.addPage([PAGE_W, PAGE_H])
    pages.push(p)
    page = p
    y = PAGE_H - MARGIN
    return p
  }

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN + 30) {
      newPage()
    }
  }

  // ─── Word-wrap and draw text ───
  function drawWrappedText(
    text: string,
    opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; x?: number; maxWidth?: number; lineHeight?: number },
  ): void {
    const f = opts.font ?? font
    const size = opts.size ?? 11
    const color = opts.color ?? COLORS.text
    const x = opts.x ?? MARGIN
    const maxWidth = opts.maxWidth ?? CONTENT_W
    const lh = opts.lineHeight ?? LINE_H

    const words = text.split(/\s+/).filter(Boolean)
    let line = ''

    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      let width: number
      try {
        width = f.widthOfTextAtSize(test, size)
      } catch {
        // Character encoding error — sanitize and retry
        const sanitized = sanitizeForPdf(test)
        try {
          width = f.widthOfTextAtSize(sanitized, size)
        } catch {
          continue // skip this word entirely
        }
      }

      if (width > maxWidth && line) {
        ensureSpace(lh)
        try {
          page.drawText(line, { x, y, size, font: f, color })
        } catch {
          page.drawText(sanitizeForPdf(line), { x, y, size, font: f, color })
        }
        y -= lh
        line = word
      } else {
        line = test
      }
    }

    if (line) {
      ensureSpace(lh)
      try {
        page.drawText(line, { x, y, size, font: f, color })
      } catch {
        page.drawText(sanitizeForPdf(line), { x, y, size, font: f, color })
      }
      y -= lh
    }
  }

  // ─── COVER PAGE ───
  newPage()

  // Dark header block
  page.drawRectangle({
    x: 0, y: PAGE_H - 220, width: PAGE_W, height: 220,
    color: COLORS.dark,
  })

  // Purple accent bar top
  page.drawRectangle({
    x: 0, y: PAGE_H, width: PAGE_W, height: 4,
    color: COLORS.purple,
  })

  // Type badge (E-BOOK or PLAYBOOK)
  const typeLabel = (options.type ?? 'ebook').toUpperCase()
  const badgeText = typeLabel === 'PLAYBOOK' ? 'PLAYBOOK' : 'E-BOOK'
  page.drawRectangle({
    x: MARGIN, y: PAGE_H - 55, width: 90, height: 26, borderRadius: 13,
    color: COLORS.purple, opacity: 0.2,
  })
  try {
    page.drawText(badgeText, {
      x: MARGIN + 12, y: PAGE_H - 48, size: 11, font: boldFont, color: COLORS.purpleLight,
    })
  } catch { /* skip badge on encoding error */ }

  // Title on cover
  const titleText = safeRaw(options.title)
  const titleLines = wrapTextToLines(titleText, boldFont, 26, CONTENT_W)
  for (let i = 0; i < titleLines.length; i++) {
    try {
      page.drawText(titleLines[i], {
        x: MARGIN, y: PAGE_H - 100 - i * 36, size: 26, font: boldFont, color: COLORS.white,
      })
    } catch { /* skip line on encoding error */ }
  }

  // Subtitle (speaker)
  const subtitleY = PAGE_H - 100 - titleLines.length * 36 - 15
  try {
    page.drawText(safeRaw(options.subtitle), {
      x: MARGIN, y: subtitleY, size: 14, font, color: COLORS.purpleLight,
    })
  } catch { /* skip */ }

  // Event name
  if (options.event) {
    try {
      page.drawText(safeRaw(options.event), {
        x: MARGIN, y: subtitleY - 24, size: 12, font, color: COLORS.textMuted,
      })
    } catch { /* skip */ }
  }

  // ScribIA branding at bottom of cover
  page.drawRectangle({
    x: MARGIN, y: 80, width: 120, height: 1, color: COLORS.purple, opacity: 0.3,
  })
  try {
    page.drawText('Gerado por', {
      x: MARGIN, y: 55, size: 10, font, color: COLORS.textMuted,
    })
    page.drawText('SCRIBIA', {
      x: MARGIN + 70, y: 55, size: 14, font: boldFont, color: COLORS.purple,
    })
  } catch { /* skip */ }

  // Purple accent bar bottom of cover
  page.drawRectangle({
    x: 0, y: 0, width: PAGE_W, height: 4, color: COLORS.purple,
  })

  // ─── TABLE OF CONTENTS ───
  const sections = parseMarkdown(markdown)
  const chapters = extractChapterTitles(sections)

  if (chapters.length > 0) {
    newPage()
    y -= 10
    try {
      page.drawText(safeRaw('Sumario'), {
        x: MARGIN, y, size: 22, font: boldFont, color: COLORS.dark,
      })
    } catch { /* skip */ }
    y -= 10
    page.drawRectangle({ x: MARGIN, y, width: 50, height: 3, color: COLORS.purple })
    y -= 25

    for (let i = 0; i < chapters.length; i++) {
      ensureSpace(24)
      const num = `${i + 1}.`
      const chTitle = safe(chapters[i])
      try {
        page.drawText(num, { x: MARGIN, y, size: 12, font: boldFont, color: COLORS.purple })
        page.drawText(chTitle, { x: MARGIN + 30, y, size: 12, font, color: COLORS.text })
      } catch { /* skip */ }
      y -= 24
    }
  }

  // ─── CONTENT PAGES ───
  newPage()
  let chapterNum = 0

  for (const section of sections) {
    switch (section.type) {
      case 'h1': {
        ensureSpace(60)
        y -= 20
        page.drawRectangle({ x: MARGIN, y: y + 4, width: CONTENT_W, height: 1, color: COLORS.divider })
        y -= 10
        drawWrappedText(safe(section.text), { font: boldFont, size: 22, color: COLORS.dark, lineHeight: 28 })
        y -= 10
        break
      }

      case 'h2': {
        chapterNum++
        // Start new page for each chapter
        newPage()
        // Chapter number accent
        try {
          page.drawText(`CAPITULO ${chapterNum}`, {
            x: MARGIN, y, size: 10, font: boldFont, color: COLORS.purple,
          })
        } catch { /* skip */ }
        y -= 8
        page.drawRectangle({ x: MARGIN, y, width: 40, height: 3, color: COLORS.purple })
        y -= 22
        drawWrappedText(safe(section.text), { font: boldFont, size: 20, color: COLORS.dark, lineHeight: 26 })
        y -= 15
        break
      }

      case 'h3': {
        ensureSpace(40)
        y -= 15
        // Small purple dot before h3
        page.drawCircle({ x: MARGIN + 4, y: y + 5, size: 3, color: COLORS.purple })
        drawWrappedText(safe(section.text), { font: boldFont, size: 14, color: COLORS.dark, x: MARGIN + 14, maxWidth: CONTENT_W - 14 })
        y -= 8
        break
      }

      case 'paragraph': {
        ensureSpace(LINE_H + PARA_SPACING)
        drawWrappedText(safe(section.text), { size: 11, color: COLORS.text })
        y -= PARA_SPACING
        break
      }

      case 'bullet': {
        if (!section.items) break
        for (const item of section.items) {
          ensureSpace(LINE_H + 4)
          try {
            page.drawText('\u2022', { x: MARGIN + 8, y, size: 11, font, color: COLORS.purple })
          } catch {
            page.drawText('-', { x: MARGIN + 8, y, size: 11, font, color: COLORS.purple })
          }
          drawWrappedText(safe(item), { x: MARGIN + 22, maxWidth: CONTENT_W - 22 })
          y -= 4
        }
        y -= PARA_SPACING
        break
      }

      case 'numbered': {
        if (!section.items) break
        for (let i = 0; i < section.items.length; i++) {
          ensureSpace(LINE_H + 4)
          const numStr = `${i + 1}.`
          try {
            page.drawText(numStr, { x: MARGIN + 4, y, size: 11, font: boldFont, color: COLORS.purple })
          } catch { /* skip */ }
          drawWrappedText(safe(section.items[i]), { x: MARGIN + 26, maxWidth: CONTENT_W - 26 })
          y -= 4
        }
        y -= PARA_SPACING
        break
      }

      case 'checkbox': {
        if (!section.items || !section.checked) break
        for (let i = 0; i < section.items.length; i++) {
          ensureSpace(LINE_H + 4)
          const isChecked = section.checked[i]
          // Draw checkbox
          page.drawRectangle({
            x: MARGIN + 6, y: y - 2, width: 10, height: 10,
            borderColor: COLORS.purple, borderWidth: 1,
            color: isChecked ? COLORS.purple : COLORS.white,
          })
          if (isChecked) {
            // Simple checkmark
            try {
              page.drawText('v', { x: MARGIN + 8, y: y - 1, size: 8, font: boldFont, color: COLORS.white })
            } catch { /* skip */ }
          }
          drawWrappedText(safe(section.items[i]), { x: MARGIN + 24, maxWidth: CONTENT_W - 24 })
          y -= 4
        }
        y -= PARA_SPACING
        break
      }

      case 'blockquote': {
        ensureSpace(LINE_H * 2 + 20)
        y -= 5
        // Quote background
        const quoteText = safe(section.text)
        const quoteLines = wrapTextToLines(quoteText, font, 11, CONTENT_W - 30)
        const quoteHeight = quoteLines.length * LINE_H + 16
        page.drawRectangle({
          x: MARGIN, y: y - quoteHeight + LINE_H + 8,
          width: CONTENT_W, height: quoteHeight,
          color: COLORS.quoteBg,
        })
        // Left accent bar
        page.drawRectangle({
          x: MARGIN, y: y - quoteHeight + LINE_H + 8,
          width: 3, height: quoteHeight,
          color: COLORS.purple,
        })
        // Quote text (italic feel — slightly lighter color)
        for (const ql of quoteLines) {
          ensureSpace(LINE_H)
          try {
            page.drawText(ql, { x: MARGIN + 15, y, size: 11, font, color: COLORS.textLight })
          } catch { /* skip */ }
          y -= LINE_H
        }
        y -= 12
        break
      }

      case 'divider': {
        ensureSpace(20)
        y -= 10
        page.drawRectangle({
          x: PAGE_W / 2 - 60, y, width: 120, height: 1, color: COLORS.divider,
        })
        y -= 15
        break
      }
    }
  }

  // ─── FOOTER ON ALL PAGES ───
  const totalPages = pages.length
  for (let i = 0; i < totalPages; i++) {
    const p = pages[i]
    // Page number (skip cover)
    if (i > 0) {
      const pageNum = `${i} / ${totalPages - 1}`
      const numWidth = font.widthOfTextAtSize(pageNum, 9)
      p.drawText(pageNum, {
        x: PAGE_W - MARGIN - numWidth, y: 25, size: 9, font, color: COLORS.textMuted,
      })
    }
    // ScribIA brand on all pages
    try {
      p.drawText('ScribIA', {
        x: MARGIN, y: 25, size: 9, font: boldFont, color: COLORS.purple, opacity: 0.5,
      })
    } catch { /* skip */ }
    // Bottom accent line
    p.drawRectangle({
      x: 0, y: 18, width: PAGE_W, height: 0.5, color: COLORS.purple, opacity: 0.15,
    })
  }

  return doc.save()
}

// ─── Utility ───

function wrapTextToLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    let width: number
    try {
      width = font.widthOfTextAtSize(test, size)
    } catch {
      try {
        width = font.widthOfTextAtSize(sanitizeForPdf(test), size)
      } catch {
        continue
      }
    }
    if (width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines.length > 0 ? lines : [text]
}
