import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  type ISectionOptions,
} from 'docx'

export class ScribiaDocxBuilder {
  private sections: ISectionOptions[] = []
  private currentChildren: Paragraph[] = []

  addCover(title: string, subtitle: string): void {
    this.currentChildren.push(
      new Paragraph({ spacing: { before: 4000 } }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'ScribIA',
            bold: true,
            size: 48,
            color: '1a1a2e',
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({ spacing: { before: 400 } }),
      new Paragraph({
        children: [
          new TextRun({
            text: title,
            bold: true,
            size: 56,
            color: '1a1a2e',
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: subtitle,
            size: 28,
            color: '666666',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
      }),
    )
    this.flushSection(true)
  }

  addHeading(text: string, level: 1 | 2 | 3 = 1): void {
    const headingLevel =
      level === 1
        ? HeadingLevel.HEADING_1
        : level === 2
          ? HeadingLevel.HEADING_2
          : HeadingLevel.HEADING_3

    this.currentChildren.push(
      new Paragraph({
        text,
        heading: headingLevel,
        spacing: { before: 300, after: 100 },
      }),
    )
  }

  addParagraph(text: string): void {
    this.currentChildren.push(
      new Paragraph({
        children: [new TextRun({ text, size: 22 })],
        spacing: { after: 120 },
      }),
    )
  }

  addBulletList(items: string[]): void {
    for (const item of items) {
      this.currentChildren.push(
        new Paragraph({
          children: [new TextRun({ text: item, size: 22 })],
          bullet: { level: 0 },
          spacing: { after: 60 },
        }),
      )
    }
  }

  addNumberedList(items: string[]): void {
    for (const item of items) {
      this.currentChildren.push(
        new Paragraph({
          children: [new TextRun({ text: item, size: 22 })],
          numbering: { reference: 'default-numbering', level: 0 },
          spacing: { after: 60 },
        }),
      )
    }
  }

  addChapter(title: string, content: string): void {
    this.addHeading(title)
    const paragraphs = content.split('\n\n')
    for (const para of paragraphs) {
      const trimmed = para.trim()
      if (trimmed) this.addParagraph(trimmed)
    }
  }

  private flushSection(pageBreak = false): void {
    if (this.currentChildren.length === 0) return

    this.sections.push({
      properties: pageBreak ? { page: { pageNumbers: { start: 1 } } } : {},
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'ScribIA', color: '999999', size: 18 }),
              ],
              alignment: AlignmentType.RIGHT,
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
                new TextRun({ text: ' / ', size: 18 }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18 }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      },
      children: [...this.currentChildren],
    })

    this.currentChildren = []
  }

  async build(): Promise<Buffer> {
    this.flushSection()

    const doc = new Document({
      numbering: {
        config: [
          {
            reference: 'default-numbering',
            levels: [
              {
                level: 0,
                format: NumberFormat.DECIMAL,
                text: '%1.',
                alignment: AlignmentType.START,
              },
            ],
          },
        ],
      },
      sections: this.sections,
    })

    return Packer.toBuffer(doc)
  }
}
