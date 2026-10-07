import * as THREE from 'three'
import { BOARD_TYPOGRAPHY, museumConfig } from '../data/museumConfig'

type TextOptions = { width?: number; height?: number; title?: boolean; align?: CanvasTextAlign; color?: string; background?: string; size?: number; lineHeight?: number; maxLines?: number }
type BoardContent = { number: string; period: string; title: string; body: string }

const BODY_FONT = '"Be Vietnam Pro", "Segoe UI", Arial, sans-serif'

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const normalizedText = text.normalize('NFC')
  const lines: string[] = []
  normalizedText.split('\n').forEach((paragraph) => {
    const trimmed = paragraph.trim()
    if (!trimmed) { lines.push(''); return }
    const words = trimmed.split(/\s+/u)
    let currentLine = ''
    words.forEach((word) => {
      const candidate = currentLine ? `${currentLine} ${word}` : word
      if (!currentLine || ctx.measureText(candidate).width <= maxWidth) currentLine = candidate
      else { lines.push(currentLine); currentLine = word }
    })
    if (currentLine) lines.push(currentLine)
  })
  return lines
}

function canvasContext(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D context is unavailable')
  return { canvas, context }
}

function textureFromCanvas(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4
  return texture
}

function drawLines(ctx: CanvasRenderingContext2D, lines: string[], x: number, top: number, lineHeight: number, maxLines: number) {
  lines.slice(0, maxLines).forEach((line, index) => ctx.fillText(line.normalize('NFC'), x, top + index * lineHeight))
}

export function textTexture(text: string, options: TextOptions = {}) {
  const width = options.width ?? 1024; const height = options.height ?? 512
  const { canvas, context: ctx } = canvasContext(width, height)
  if (options.background) { ctx.fillStyle = options.background; ctx.fillRect(0, 0, width, height) }
  let size = options.size ?? (options.title ? 58 : 32)
  let lineHeight = options.lineHeight ?? size * 1.35
  ctx.fillStyle = options.color ?? museumConfig.colors.text
  ctx.textAlign = options.align ?? 'left'; ctx.textBaseline = 'top'
  ctx.font = `${options.title ? '600' : '400'} ${size}px ${BODY_FONT}`
  const x = ctx.textAlign === 'center' ? width / 2 : 56
  const maxWidth = width - 112
  let lines = wrapText(ctx, text.normalize('NFC'), maxWidth)
  while (lines.length * lineHeight > height - 48 && size > 16) {
    const factor = .95; size *= factor; lineHeight *= factor
    ctx.font = `${options.title ? '600' : '400'} ${size}px ${BODY_FONT}`
    lines = wrapText(ctx, text.normalize('NFC'), maxWidth)
  }
  const rendered = lines.slice(0, options.maxLines ?? lines.length)
  const top = Math.max(24, (height - rendered.length * lineHeight) / 2)
  drawLines(ctx, rendered, x, top, lineHeight, rendered.length)
  return textureFromCanvas(canvas)
}

export function boardTexture(content: BoardContent) {
  const typography = BOARD_TYPOGRAPHY
  const { canvas, context: ctx } = canvasContext(typography.textureWidth, typography.textureHeight)
  const left = typography.horizontalPadding
  const maxWidth = typography.textureWidth - typography.horizontalPadding * 2
  ctx.fillStyle = '#211d19'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  const gradient = ctx.createRadialGradient(canvas.width * .5, canvas.height * .45, 40, canvas.width * .5, canvas.height * .5, canvas.width * .72)
  gradient.addColorStop(0, 'rgba(255,213,154,0.055)'); gradient.addColorStop(1, 'rgba(255,213,154,0)'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = museumConfig.colors.bronze
  ctx.font = `600 ${typography.numberSize}px ${typography.fontFamily}`
  ctx.fillText(content.number.normalize('NFC'), left, typography.numberY)
  ctx.fillStyle = museumConfig.colors.secondary; ctx.font = `600 ${typography.periodSize}px ${typography.fontFamily}`
  ctx.fillText(content.period.normalize('NFC'), left, typography.periodY)
  ctx.fillStyle = museumConfig.colors.text; ctx.font = `700 ${typography.titleSize}px ${typography.fontFamily}`
  let titleSize: number = typography.titleSize
  let titleLines = wrapText(ctx, content.title, maxWidth)
  while (titleLines.length > typography.titleMaxLines && titleSize > 24) {
    titleSize -= 2; ctx.font = `700 ${titleSize}px ${typography.fontFamily}`
    titleLines = wrapText(ctx, content.title, maxWidth)
  }
  drawLines(ctx, titleLines, left, typography.titleTop, typography.titleLineHeight, typography.titleMaxLines)
  ctx.fillStyle = 'rgba(164,130,82,.58)'; ctx.fillRect(left, typography.separatorY, maxWidth, 2)
  ctx.fillStyle = museumConfig.colors.text; ctx.font = `400 ${typography.bodySize}px ${typography.fontFamily}`
  let bodySize: number = typography.bodySize
  let bodyLines = wrapText(ctx, content.body, maxWidth)
  while (bodyLines.length > typography.bodyMaxLines && bodySize > 18) {
    bodySize--; ctx.font = `400 ${bodySize}px ${typography.fontFamily}`
    bodyLines = wrapText(ctx, content.body, maxWidth)
  }
  drawLines(ctx, bodyLines, left, typography.bodyTop, typography.bodyLineHeight, typography.bodyMaxLines)
  return textureFromCanvas(canvas)
}

export function textPlane(text: string, width: number, height: number, options: TextOptions = {}) {
  const material = new THREE.MeshBasicMaterial({ map: textTexture(text.normalize('NFC'), options), transparent: true, depthWrite: false, side: THREE.DoubleSide })
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
}

export function boardPlane(content: BoardContent, width: number, height: number) {
  const texture = boardTexture(content)
  const material = new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: new THREE.Color('#2b2119'), emissiveIntensity: .08, roughness: .82 })
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
}
