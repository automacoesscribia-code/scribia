// Ebook image generation — SVG-based (Deno-native, zero external deps)
// Generates: cover, chapter dividers, quote cards, footer with ScribIA branding
// Design system: Purple #6B4EFF, Dark #0A0A0F, Syne/DM Sans fonts

// ─── Types ───

export interface EbookImageContext {
  title: string
  speaker: string
  event: string
  summary?: string
}

export interface ParsedPlaceholder {
  type: 'cover' | 'chapter' | 'illustration' | 'quote' | 'footer'
  id: string
  description: string
  raw: string
}

// ─── Design Tokens ───

const COLORS = {
  bgDark: '#0A0A0F',
  bg2: '#111118',
  bg3: '#17171F',
  bg4: '#1E1E28',
  purple: '#6B4EFF',
  purpleLight: '#8B71FF',
  purpleDark: '#4A35CC',
  text: '#F0EFF8',
  text2: '#9896B0',
  text3: '#5C5A72',
  green: '#00D4A0',
}

// ─── SVG Generators ───

export function generateCoverSvg(ctx: EbookImageContext): string {
  const displayTitle = truncate(ctx.title, 80)
  const lines = wrapText(displayTitle, 28)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="cover-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${COLORS.bgDark}"/>
      <stop offset="100%" stop-color="${COLORS.bg4}"/>
    </linearGradient>
    <linearGradient id="accent-line" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${COLORS.purple}"/>
      <stop offset="100%" stop-color="${COLORS.purpleLight}"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#cover-bg)"/>

  <!-- Decorative circles -->
  <circle cx="1050" cy="100" r="200" fill="${COLORS.purple}" opacity="0.06"/>
  <circle cx="1100" cy="180" r="120" fill="${COLORS.purpleLight}" opacity="0.04"/>
  <circle cx="150" cy="500" r="150" fill="${COLORS.purple}" opacity="0.04"/>

  <!-- Top accent bar -->
  <rect x="0" y="0" width="1200" height="5" fill="url(#accent-line)"/>

  <!-- Event badge -->
  <rect x="60" y="50" width="${Math.min(esc(ctx.event).length * 10 + 40, 500)}" height="36" rx="18" fill="${COLORS.purple}" opacity="0.15"/>
  <text x="80" y="74" fill="${COLORS.purpleLight}" font-size="16" font-family="'DM Sans', sans-serif" font-weight="500">${esc(ctx.event)}</text>

  <!-- Title -->
  ${lines.map((line, i) => `<text x="60" y="${200 + i * 60}" fill="${COLORS.text}" font-size="48" font-family="'Syne', sans-serif" font-weight="700" letter-spacing="-0.5">${esc(line)}</text>`).join('\n  ')}

  <!-- Speaker -->
  <text x="60" y="${200 + lines.length * 60 + 40}" fill="${COLORS.purple}" font-size="24" font-family="'DM Sans', sans-serif" font-weight="500">por ${esc(ctx.speaker)}</text>

  <!-- Divider line -->
  <rect x="60" y="${530}" width="200" height="2" fill="${COLORS.purple}" opacity="0.4"/>

  <!-- ScribIA branding -->
  <text x="60" y="580" fill="${COLORS.text2}" font-size="14" font-family="'DM Sans', sans-serif">Gerado por</text>
  <text x="155" y="580" fill="${COLORS.purple}" font-size="18" font-family="'Syne', sans-serif" font-weight="800" letter-spacing="2">SCRIBIA</text>

  <!-- Bottom accent bar -->
  <rect x="0" y="625" width="1200" height="5" fill="url(#accent-line)"/>
</svg>`
}

export function generateChapterSvg(chapterNum: number, chapterTitle: string): string {
  const displayTitle = truncate(chapterTitle, 60)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="300" viewBox="0 0 1200 300">
  <defs>
    <linearGradient id="ch-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${COLORS.bg2}"/>
      <stop offset="100%" stop-color="${COLORS.bg3}"/>
    </linearGradient>
    <linearGradient id="ch-accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${COLORS.purple}"/>
      <stop offset="100%" stop-color="${COLORS.purpleLight}"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="300" fill="url(#ch-bg)"/>

  <!-- Top accent bar -->
  <rect x="0" y="0" width="1200" height="4" fill="url(#ch-accent)"/>

  <!-- Big number (background decoration) -->
  <text x="900" y="250" fill="${COLORS.purple}" opacity="0.08" font-size="250" font-family="'Syne', sans-serif" font-weight="800" text-anchor="middle">${String(chapterNum).padStart(2, '0')}</text>

  <!-- Chapter label -->
  <text x="60" y="110" fill="${COLORS.text2}" font-size="16" font-family="'DM Sans', sans-serif" font-weight="500" letter-spacing="3" text-transform="uppercase">CAPÍTULO ${chapterNum}</text>

  <!-- Divider -->
  <rect x="60" y="130" width="60" height="3" fill="${COLORS.purple}"/>

  <!-- Title -->
  <text x="60" y="200" fill="${COLORS.text}" font-size="36" font-family="'Syne', sans-serif" font-weight="700">${esc(displayTitle)}</text>

  <!-- Bottom subtle line -->
  <rect x="60" y="270" width="1080" height="1" fill="${COLORS.text3}" opacity="0.3"/>
</svg>`
}

export function generateQuoteSvg(quote: string, speaker: string): string {
  const lines = wrapText(truncate(quote, 200), 55)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${140 + lines.length * 30}" viewBox="0 0 800 ${140 + lines.length * 30}">
  <defs>
    <linearGradient id="q-border" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${COLORS.purple}"/>
      <stop offset="100%" stop-color="${COLORS.purpleDark}"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="800" height="${140 + lines.length * 30}" rx="12" fill="${COLORS.bg2}" stroke="${COLORS.purple}" stroke-opacity="0.2" stroke-width="1"/>

  <!-- Left accent bar -->
  <rect x="0" y="0" width="4" height="${140 + lines.length * 30}" rx="2" fill="url(#q-border)"/>

  <!-- Big quote mark -->
  <text x="40" y="75" fill="${COLORS.purple}" opacity="0.15" font-size="80" font-family="Georgia, serif">"</text>

  <!-- Quote text -->
  ${lines.map((line, i) => `<text x="50" y="${80 + i * 30}" fill="${COLORS.text}" font-size="18" font-family="'DM Sans', sans-serif" font-style="italic">${esc(line)}</text>`).join('\n  ')}

  <!-- Speaker -->
  <text x="50" y="${80 + lines.length * 30 + 30}" fill="${COLORS.purple}" font-size="14" font-family="'DM Sans', sans-serif" font-weight="500">— ${esc(speaker)}</text>
</svg>`
}

export function generateFooterSvg(tagline = 'Transformando palestras em conhecimento'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="200" viewBox="0 0 1200 200">
  <!-- Background -->
  <rect width="1200" height="200" fill="${COLORS.bgDark}"/>

  <!-- Top separator -->
  <rect x="400" y="20" width="400" height="1" fill="${COLORS.purple}" opacity="0.3"/>

  <!-- ScribIA Logo (text-based, matching brand) -->
  <text x="600" y="90" text-anchor="middle" fill="${COLORS.purple}" font-size="42" font-family="'Syne', sans-serif" font-weight="800" letter-spacing="6">SCRIBIA</text>

  <!-- Mic icon indicator (small decorative) -->
  <circle cx="600" cy="110" r="3" fill="${COLORS.purpleLight}" opacity="0.6"/>

  <!-- Tagline -->
  <text x="600" y="140" text-anchor="middle" fill="${COLORS.text2}" font-size="14" font-family="'DM Sans', sans-serif" font-style="italic">${esc(tagline)}</text>

  <!-- URL -->
  <text x="600" y="170" text-anchor="middle" fill="${COLORS.text3}" font-size="12" font-family="'DM Mono', monospace">scribia.com.br</text>
</svg>`
}

// ─── Placeholder Parser ───

export function parsePlaceholders(markdown: string): ParsedPlaceholder[] {
  const regex = /<!-- IMAGE: (\S+)\s*\|\s*(.+?) -->/g
  const placeholders: ParsedPlaceholder[] = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(markdown)) !== null) {
    const id = match[1]
    const description = match[2].trim()

    let type: ParsedPlaceholder['type'] = 'illustration'
    if (id === 'cover') type = 'cover'
    else if (id.startsWith('chapter-')) type = 'chapter'
    else if (id.startsWith('quote-')) type = 'quote'
    else if (id === 'footer') type = 'footer'

    placeholders.push({ type, id, description, raw: match[0] })
  }

  return placeholders
}

// ─── Main Pipeline ───

export interface GeneratedImage {
  placeholder: ParsedPlaceholder
  svg: string
  storagePath: string
}

export function generateEbookImages(
  ctx: EbookImageContext,
  placeholders: ParsedPlaceholder[],
  basePath: string,
): GeneratedImage[] {
  const images: GeneratedImage[] = []
  let chapterCount = 0

  for (const ph of placeholders) {
    let svg: string

    switch (ph.type) {
      case 'cover':
        svg = generateCoverSvg(ctx)
        break
      case 'chapter': {
        chapterCount++
        const chapterTitle = ph.description.replace(/^Divisor:\s*/, '')
        svg = generateChapterSvg(chapterCount, chapterTitle)
        break
      }
      case 'quote': {
        const quoteMatch = ph.description.match(/^Citação:\s*"(.+?)"\s*—\s*(.+)$/)
        if (quoteMatch) {
          svg = generateQuoteSvg(quoteMatch[1], quoteMatch[2])
        } else {
          svg = generateQuoteSvg(ph.description, ctx.speaker)
        }
        break
      }
      case 'footer':
        svg = generateFooterSvg()
        break
      default:
        // illustration type - skip for now (requires AI image gen)
        continue
    }

    images.push({
      placeholder: ph,
      svg,
      storagePath: `${basePath}/images/${ph.id}.svg`,
    })
  }

  return images
}

export function replacePlaceholdersWithUrls(
  markdown: string,
  images: GeneratedImage[],
  urlMap: Map<string, string>,
): string {
  let result = markdown

  for (const img of images) {
    const url = urlMap.get(img.placeholder.id)
    if (url) {
      const altText = img.placeholder.description
      result = result.replace(
        img.placeholder.raw,
        `![${altText}](${url})`,
      )
    }
  }

  return result
}

// ─── Utilities ───

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 3) + '...' : s
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxCharsPerLine) {
      if (current) lines.push(current.trim())
      current = word
    } else {
      current = current ? current + ' ' + word : word
    }
  }
  if (current) lines.push(current.trim())

  return lines.length > 0 ? lines : [text]
}
