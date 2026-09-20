import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib'
import { Sow } from './types'

const NAVY = rgb(0.12, 0.19, 0.31)
const WINE = rgb(0.49, 0.09, 0.16)
const INK = rgb(0.15, 0.15, 0.2)
const INK_SOFT = rgb(0.4, 0.4, 0.45)
const LINE = rgb(0.85, 0.85, 0.87)
const WHITE = rgb(1, 1, 1)

function fmtMoney(v: number | null | undefined): string {
  if (v == null) return '—'
  return `$${Math.round(v).toLocaleString()}`
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  const dt = new Date(d)
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${mo[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`
}

function capitalize(s: string | null | undefined): string {
  if (!s) return '—'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

interface DrawTextOptions {
  x: number
  y: number
  size?: number
  font?: PDFFont
  color?: ReturnType<typeof rgb>
  maxWidth?: number
  lineHeight?: number
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  opts: DrawTextOptions & { font: PDFFont }
): number {
  const { x, y, size = 11, font, color = INK, maxWidth = 400, lineHeight = 16 } = opts
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    const width = font.widthOfTextAtSize(test, size)
    if (width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)

  let curY = y
  for (const line of lines) {
    if (curY < 60) break
    page.drawText(line, { x, y: curY, size, font, color })
    curY -= lineHeight
  }
  return curY
}

export async function generateSowPdf(
  sow: Sow,
  options?: {
    internalSignatureDataUrl?: string
    clientSignatureDataUrl?: string
    orgName?: string
  }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 612
  const pageHeight = 792
  const margin = 56
  const contentWidth = pageWidth - margin * 2

  function newPage(): { page: PDFPage; y: number } {
    const page = pdfDoc.addPage([pageWidth, pageHeight])
    // Header bar
    page.drawRectangle({ x: 0, y: pageHeight - 50, width: pageWidth, height: 50, color: NAVY })
    // Org name
    const orgDisplay = options?.orgName ?? 'Vérité Health Collective'
    page.drawText(orgDisplay, { x: margin, y: pageHeight - 33, size: 11, font: helveticaBold, color: WHITE })
    // SOW label
    const label = 'STATEMENT OF WORK'
    const labelW = helveticaBold.widthOfTextAtSize(label, 9)
    page.drawText(label, { x: pageWidth - margin - labelW, y: pageHeight - 33, size: 9, font: helveticaBold, color: rgb(0.8, 0.8, 0.85) })
    // Footer line
    page.drawLine({ start: { x: margin, y: 36 }, end: { x: pageWidth - margin, y: 36 }, thickness: 0.5, color: LINE })
    page.drawText('Confidential — Vérité Health Collective', { x: margin, y: 22, size: 8, font: helvetica, color: INK_SOFT })
    return { page, y: pageHeight - 70 }
  }

  let { page, y } = newPage()

  // Title block
  const titleSize = 18
  const titleLines = sow.title.length > 60
    ? [sow.title.slice(0, 60), sow.title.slice(60)]
    : [sow.title]

  for (const line of titleLines) {
    page.drawText(line, { x: margin, y, size: titleSize, font: helveticaBold, color: NAVY })
    y -= 24
  }

  // Version + status row
  const versionStr = `Version ${sow.version}`
  page.drawText(versionStr, { x: margin, y, size: 10, font: helvetica, color: INK_SOFT })

  const statusLabel = sow.status.toUpperCase()
  const statusW = helveticaBold.widthOfTextAtSize(statusLabel, 8)
  page.drawRectangle({ x: pageWidth - margin - statusW - 16, y: y - 4, width: statusW + 16, height: 16, color: WINE })
  page.drawText(statusLabel, { x: pageWidth - margin - statusW - 8, y: y + 1, size: 8, font: helveticaBold, color: WHITE })
  y -= 28

  // Divider
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: LINE })
  y -= 20

  // Details table (2-column grid)
  const details = [
    ['Total Value', fmtMoney(sow.total_value)],
    ['Revenue Type', capitalize(sow.revenue_type)],
    ['Payment Terms', sow.payment_terms || '—'],
    ['Billing Frequency', capitalize(sow.billing_frequency)],
    ['Effective Date', fmtDate(sow.effective_date)],
    ['Expiry Date', fmtDate(sow.expiry_date)],
  ]
  const colW = contentWidth / 2
  for (let i = 0; i < details.length; i += 2) {
    const left = details[i]
    const right = details[i + 1]
    page.drawText(left[0], { x: margin, y, size: 8, font: helveticaBold, color: INK_SOFT })
    page.drawText(left[1], { x: margin, y: y - 13, size: 11, font: helvetica, color: INK })
    if (right) {
      page.drawText(right[0], { x: margin + colW, y, size: 8, font: helveticaBold, color: INK_SOFT })
      page.drawText(right[1], { x: margin + colW, y: y - 13, size: 11, font: helvetica, color: INK })
    }
    y -= 38
  }
  y -= 10

  // Sections
  const sections: [string, string | null][] = [
    ['Objectives', sow.objectives],
    ['Scope of Work', sow.scope_of_work],
    ['Out of Scope', sow.out_of_scope],
    ['Assumptions', sow.assumptions],
    ['Client Responsibilities', sow.client_responsibilities],
    ['Notes', sow.notes],
  ]

  for (const [sectionTitle, content] of sections) {
    if (!content?.trim()) continue

    if (y < 120) {
      const np = newPage()
      page = np.page
      y = np.y
    }

    // Section heading bg
    page.drawRectangle({ x: margin, y: y - 4, width: contentWidth, height: 20, color: rgb(0.95, 0.95, 0.97) })
    page.drawText(sectionTitle.toUpperCase(), { x: margin + 8, y: y + 1, size: 8, font: helveticaBold, color: NAVY })
    y -= 22

    // Content - split by newlines
    const paragraphs = content.split('\n').filter(p => p.trim())
    for (const para of paragraphs) {
      if (y < 80) {
        const np = newPage()
        page = np.page
        y = np.y
      }
      y = drawWrappedText(page, para, { x: margin + 8, y, size: 10, font: helvetica, color: INK, maxWidth: contentWidth - 16, lineHeight: 15 })
      y -= 6
    }
    y -= 14
  }

  // Phases
  if (sow.phases && sow.phases.length > 0) {
    if (y < 120) {
      const np = newPage()
      page = np.page
      y = np.y
    }
    page.drawRectangle({ x: margin, y: y - 4, width: contentWidth, height: 20, color: rgb(0.95, 0.95, 0.97) })
    page.drawText('PHASES', { x: margin + 8, y: y + 1, size: 8, font: helveticaBold, color: NAVY })
    y -= 24

    for (const phase of sow.phases) {
      if (y < 100) {
        const np = newPage()
        page = np.page
        y = np.y
      }
      page.drawText(phase.title, { x: margin + 8, y, size: 11, font: helveticaBold, color: INK })
      y -= 16
      if (phase.description?.trim()) {
        y = drawWrappedText(page, phase.description, { x: margin + 16, y, size: 10, font: helvetica, color: INK_SOFT, maxWidth: contentWidth - 24, lineHeight: 14 })
      }
      y -= 12
    }
  }

  // Signature block — always on a page with enough room; add new page if <180
  if (y < 200) {
    const np = newPage()
    page = np.page
    y = np.y
  }

  y -= 10
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: LINE })
  y -= 24

  page.drawText('SIGNATURES', { x: margin, y, size: 8, font: helveticaBold, color: NAVY })
  y -= 20

  const sigColW = contentWidth / 2 - 16
  const leftX = margin
  const rightX = margin + contentWidth / 2 + 8

  // Left: Vérité
  const orgSigLabel = `Authorized by ${options?.orgName ?? 'Vérité Health Collective'}`
  page.drawText(orgSigLabel, { x: leftX, y, size: 8, font: helveticaBold, color: INK_SOFT })

  // Right: Client
  page.drawText('Client Authorized Signatory', { x: rightX, y, size: 8, font: helveticaBold, color: INK_SOFT })
  y -= 16

  // Embed signatures if available
  if (options?.internalSignatureDataUrl) {
    try {
      const base64 = options.internalSignatureDataUrl.split(',')[1]
      const pngBytes = Buffer.from(base64, 'base64')
      const img = await pdfDoc.embedPng(pngBytes)
      const imgH = 50
      const imgW = Math.min(sigColW, img.width * imgH / img.height)
      page.drawImage(img, { x: leftX, y: y - imgH, width: imgW, height: imgH, opacity: 0.9 })
    } catch { /* skip */ }
  }

  if (options?.clientSignatureDataUrl) {
    try {
      const base64 = options.clientSignatureDataUrl.split(',')[1]
      const pngBytes = Buffer.from(base64, 'base64')
      const img = await pdfDoc.embedPng(pngBytes)
      const imgH = 50
      const imgW = Math.min(sigColW, img.width * imgH / img.height)
      page.drawImage(img, { x: rightX, y: y - imgH, width: imgW, height: imgH, opacity: 0.9 })
    } catch { /* skip */ }
  }

  y -= 58

  // Signature lines
  page.drawLine({ start: { x: leftX, y }, end: { x: leftX + sigColW, y }, thickness: 0.5, color: INK })
  page.drawLine({ start: { x: rightX, y }, end: { x: rightX + sigColW, y }, thickness: 0.5, color: INK })
  y -= 14

  // Name / Title / Date fields
  const nameLeft = sow.verite_signatory || '_________________________'
  const nameRight = sow.client_signatory || '_________________________'
  page.drawText(`Name: ${nameLeft}`, { x: leftX, y, size: 9, font: helvetica, color: INK })
  page.drawText(`Name: ${nameRight}`, { x: rightX, y, size: 9, font: helvetica, color: INK })
  y -= 14
  page.drawText('Title: _________________________', { x: leftX, y, size: 9, font: helvetica, color: INK })
  page.drawText('Title: _________________________', { x: rightX, y, size: 9, font: helvetica, color: INK })
  y -= 14
  const dateLeft = sow.signed_date ? fmtDate(sow.signed_date) : '_________________________'
  page.drawText(`Date: ${dateLeft}`, { x: leftX, y, size: 9, font: helvetica, color: INK })
  page.drawText('Date: _________________________', { x: rightX, y, size: 9, font: helvetica, color: INK })

  return pdfDoc.save()
}
