import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib'

const SCRIBIA_DARK = rgb(0.102, 0.102, 0.18) // #1a1a2e
const SCRIBIA_ACCENT = rgb(0.914, 0.271, 0.376) // #e94560
const PAGE_WIDTH = 595 // A4
const PAGE_HEIGHT = 842 // A4
const MARGIN = 50
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN
const LINE_HEIGHT = 16
const FONT_SIZE_BODY = 11
const FONT_SIZE_HEADING = 18
const FONT_SIZE_TITLE = 28
const FONT_SIZE_SUBTITLE = 14

export class ScribiaPdfBuilder {
  private doc!: PDFDocument
  private font!: PDFFont
  private boldFont!: PDFFont
  private pages: PDFPage[] = []
  private currentPage!: PDFPage
  private cursorY = PAGE_HEIGHT - MARGIN

  async init(): Promise<this> {
    this.doc = await PDFDocument.create()
    this.font = await this.doc.embedFont(StandardFonts.Helvetica)
    this.boldFont = await this.doc.embedFont(StandardFonts.HelveticaBold)
    return this
  }

  private addPage(): PDFPage {
    const page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    this.pages.push(page)
    this.currentPage = page
    this.cursorY = PAGE_HEIGHT - MARGIN
    return page
  }

  private ensureSpace(needed: number) {
    if (this.cursorY - needed < MARGIN) {
      this.addPage()
    }
  }

  private drawText(
    text: string,
    options: {
      font?: PDFFont
      size?: number
      color?: ReturnType<typeof rgb>
      x?: number
      maxWidth?: number
    } = {},
  ) {
    const font = options.font ?? this.font
    const size = options.size ?? FONT_SIZE_BODY
    const color = options.color ?? SCRIBIA_DARK
    const x = options.x ?? MARGIN
    const maxWidth = options.maxWidth ?? CONTENT_WIDTH

    // Word-wrap
    const words = text.split(' ')
    let line = ''
    const lines: string[] = []

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word
      const width = font.widthOfTextAtSize(testLine, size)
      if (width > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = testLine
      }
    }
    if (line) lines.push(line)

    for (const l of lines) {
      this.ensureSpace(LINE_HEIGHT)
      this.currentPage.drawText(l, { x, y: this.cursorY, size, font, color })
      this.cursorY -= LINE_HEIGHT
    }
  }

  async addCover(title: string, subtitle: string, logo?: Uint8Array): Promise<void> {
    const page = this.addPage()

    // Background accent bar
    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 200,
      width: PAGE_WIDTH,
      height: 200,
      color: SCRIBIA_DARK,
    })

    // Logo
    if (logo) {
      try {
        const img = await this.doc.embedPng(logo)
        const scale = 60 / img.height
        page.drawImage(img, {
          x: MARGIN,
          y: PAGE_HEIGHT - 80,
          width: img.width * scale,
          height: 60,
        })
      } catch {
        // If logo embed fails, just show text
        page.drawText('ScribIA', {
          x: MARGIN,
          y: PAGE_HEIGHT - 70,
          size: 24,
          font: this.boldFont,
          color: rgb(1, 1, 1),
        })
      }
    } else {
      page.drawText('ScribIA', {
        x: MARGIN,
        y: PAGE_HEIGHT - 70,
        size: 24,
        font: this.boldFont,
        color: rgb(1, 1, 1),
      })
    }

    // Title
    page.drawText(title, {
      x: MARGIN,
      y: PAGE_HEIGHT - 140,
      size: FONT_SIZE_TITLE,
      font: this.boldFont,
      color: rgb(1, 1, 1),
      maxWidth: CONTENT_WIDTH,
    })

    // Subtitle
    page.drawText(subtitle, {
      x: MARGIN,
      y: PAGE_HEIGHT - 175,
      size: FONT_SIZE_SUBTITLE,
      font: this.font,
      color: rgb(0.8, 0.8, 0.85),
    })

    // Accent line
    page.drawRectangle({
      x: MARGIN,
      y: PAGE_HEIGHT - 210,
      width: 100,
      height: 3,
      color: SCRIBIA_ACCENT,
    })

    this.cursorY = PAGE_HEIGHT - 250
  }

  async addTableOfContents(chapters: string[]): Promise<void> {
    this.addPage()
    this.drawText('Sumário', { font: this.boldFont, size: FONT_SIZE_HEADING })
    this.cursorY -= 10

    chapters.forEach((chapter, i) => {
      this.drawText(`${i + 1}. ${chapter}`, { size: 12 })
      this.cursorY -= 4
    })
  }

  async addChapter(title: string, content: string): Promise<void> {
    this.addPage()

    // Chapter title with accent
    this.currentPage.drawRectangle({
      x: MARGIN,
      y: this.cursorY + 4,
      width: 4,
      height: 20,
      color: SCRIBIA_ACCENT,
    })
    this.drawText(title, {
      font: this.boldFont,
      size: FONT_SIZE_HEADING,
      x: MARGIN + 12,
    })
    this.cursorY -= 10

    // Content paragraphs
    const paragraphs = content.split('\n\n')
    for (const para of paragraphs) {
      const trimmed = para.trim()
      if (!trimmed) continue
      this.drawText(trimmed)
      this.cursorY -= 8
    }
  }

  addFooter(): void {
    const totalPages = this.pages.length
    this.pages.forEach((page, i) => {
      const text = `ScribIA — Página ${i + 1} de ${totalPages}`
      const width = this.font.widthOfTextAtSize(text, 9)
      page.drawText(text, {
        x: PAGE_WIDTH - MARGIN - width,
        y: 25,
        size: 9,
        font: this.font,
        color: rgb(0.5, 0.5, 0.5),
      })
    })
  }

  async build(): Promise<Uint8Array> {
    return this.doc.save()
  }
}
