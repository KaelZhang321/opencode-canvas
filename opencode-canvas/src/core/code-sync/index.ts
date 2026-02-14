import type { EditorNode, EditorState } from '../editor-store/types'
import { DEFAULT_VIEWPORT } from '../editor-store/types'

export const OCODE_BLOCK_START = '/* OCODE-CANVAS-START */'
export const OCODE_BLOCK_END = '/* OCODE-CANVAS-END */'
const OCODE_BLOCK_START_PREFIX = '/* OCODE-CANVAS-START'

export interface CodeSyncResult {
  applied: boolean
  reason?: string
  patchedSource?: string
  changedLineCount?: number
}

interface MarkerValidationResult {
  valid: boolean
  reason?: string
  startIndex?: number
  endIndex?: number
  startHash?: string
}

export interface CodeSyncPreview {
  code: string
  hasChanges: boolean
  changedLineCount: number
}

export interface SyncValidation {
  errors: string[]
  warnings: string[]
}

export interface CodeParseResult {
  ok: boolean
  state?: EditorState
  reason?: string
}

export interface SemanticDiffSummary {
  added: number
  removed: number
  moved: number
  resized: number
  textChanged: number
  styleChanged: number
}

function checksum(input: string): string {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24)
  }
  return (hash >>> 0).toString(16)
}

function validateMarkerStructure(source: string): MarkerValidationResult {
  const startRegex = /\/\*\s*OCODE-CANVAS-START(?:\s+hash:([a-f0-9]+))?\s*\*\//g
  const endRegex = /\/\*\s*OCODE-CANVAS-END\s*\*\//g

  const startMatches = [...source.matchAll(startRegex)]
  const endMatches = [...source.matchAll(endRegex)]

  if (startMatches.length !== 1 || endMatches.length !== 1) {
    return {
      valid: false,
      reason:
        'Patch requires exactly one start marker and one end marker in target source.',
    }
  }

  const start = startMatches[0]
  const end = endMatches[0]
  const startIndex = start?.index ?? -1
  const endIndex = end?.index ?? -1

  if (startIndex < 0 || endIndex < 0 || startIndex >= endIndex) {
    return {
      valid: false,
      reason: 'Marker order is invalid. Ensure START appears before END.',
    }
  }

  return {
    valid: true,
    startIndex,
    endIndex,
    startHash: start?.[1],
  }
}

function escapeDoubleQuoted(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
}

function escapeJsxText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function createStyleObjectLiteral(node: EditorNode): string {
  const styleParts = [
    `left: ${node.x}`,
    `top: ${node.y}`,
    `width: ${node.width}`,
    `minHeight: ${node.height}`,
  ]
  Object.entries(node.style ?? {}).forEach(([key, value]) => {
    if (typeof value !== 'string') {
      return
    }
    const styleKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
      ? key
      : JSON.stringify(key)
    styleParts.push(`${styleKey}: ${JSON.stringify(value)}`)
  })
  return `{ ${styleParts.join(', ')} }`
}

function renderNodeLine(node: EditorNode): string {
  const textContent = escapeJsxText(node.text ?? node.name)
  const className = ['absolute', node.className ?? ''].filter(Boolean).join(' ')
  const attributes = [
    `key="${escapeDoubleQuoted(node.id)}"`,
    `className="${escapeDoubleQuoted(className)}"`,
    `style={${createStyleObjectLiteral(node)}}`,
    `data-node-type="${escapeDoubleQuoted(node.type)}"`,
  ]
  if (node.type === 'image' && node.src) {
    attributes.push(`data-src="${escapeDoubleQuoted(node.src)}"`)
  }
  return `<div ${attributes.join(' ')}>${textContent}</div>`
}

function buildGeneratedCanvasBlock(state: EditorState): string {
  return state.rootIds
    .map((id) => state.nodeMap[id])
    .filter((node): node is EditorNode => Boolean(node))
    .map((node) => renderNodeLine(node))
    .join('\n')
}

export function buildGeneratedComponentSource(state: EditorState): string {
  const body = state.rootIds
    .map((id) => state.nodeMap[id])
    .filter((node): node is EditorNode => Boolean(node))
    .map((node) => `      ${renderNodeLine(node)}`)
    .join('\n')

  return [
    "import React from 'react'",
    '',
    'export function GeneratedCanvasView() {',
    '  return (',
    '    <div className="relative h-[1200px] w-[1600px]">',
    body,
    '    </div>',
    '  )',
    '}',
    '',
  ].join('\n')
}

function countChangedLines(previous: string, next: string): number {
  const prevLines = previous.split('\n')
  const nextLines = next.split('\n')
  const maxLength = Math.max(prevLines.length, nextLines.length)
  let changed = 0
  for (let index = 0; index < maxLength; index += 1) {
    if ((prevLines[index] ?? '') !== (nextLines[index] ?? '')) {
      changed += 1
    }
  }
  return changed
}

export function createCodeSyncPreview(
  state: EditorState,
  baselineCode: string,
): CodeSyncPreview {
  const code = buildGeneratedComponentSource(state)
  const changedLineCount = countChangedLines(baselineCode, code)
  return {
    code,
    hasChanges: changedLineCount > 0,
    changedLineCount,
  }
}

function getLineIndent(line: string): string {
  const match = line.match(/^\s*/)
  return match?.[0] ?? ''
}

function indentBlock(block: string, indent: string): string {
  return block
    .split('\n')
    .map((line) => `${indent}${line.trimStart()}`)
    .join('\n')
}

export function applyMarkerPatchToSource(
  source: string,
  state: EditorState,
  options?: { force?: boolean },
): CodeSyncResult {
  const markerCheck = validateMarkerStructure(source)
  if (!markerCheck.valid) {
    return {
      applied: false,
      reason:
        markerCheck.reason ??
        `Patch markers not found. Please add ${OCODE_BLOCK_START} and ${OCODE_BLOCK_END}.`,
    }
  }

  const startIndex = markerCheck.startIndex ?? -1
  const endIndex = markerCheck.endIndex ?? -1

  const startLineStart = source.lastIndexOf('\n', startIndex)
  const startLineEnd = source.indexOf('\n', startIndex)
  const lineStart = startLineStart < 0 ? 0 : startLineStart + 1
  const lineEnd = startLineEnd < 0 ? source.length : startLineEnd
  const markerLine = source.slice(lineStart, lineEnd)
  const indent = getLineIndent(markerLine)

  const generated = indentBlock(buildGeneratedCanvasBlock(state), indent)
  const insertionStart = source.indexOf('\n', startIndex) + 1
  const insertionEnd = source.lastIndexOf('\n', endIndex)

  if (insertionStart <= 0 || insertionEnd < insertionStart) {
    return {
      applied: false,
      reason: 'Invalid marker block boundaries.',
    }
  }

  const currentBlock = source.slice(insertionStart, insertionEnd + 1)
  const currentHash = checksum(currentBlock)
  const markerHash = markerCheck.startHash
  if (markerHash && markerHash !== currentHash && !options?.force) {
    return {
      applied: false,
      reason:
        'Marker hash mismatch. Target block changed manually. Enable force to override.',
    }
  }

  const newStartMarker = `${OCODE_BLOCK_START_PREFIX} hash:${checksum(`${generated}\n`)} */`
  const startMarkerLineEnd = source.indexOf('\n', startIndex)

  const withUpdatedStartMarker =
    source.slice(0, lineStart) +
    `${indent}${newStartMarker}` +
    source.slice(startMarkerLineEnd)

  const normalizedStartIndex = withUpdatedStartMarker.indexOf(newStartMarker)
  const normalizedInsertionStart =
    withUpdatedStartMarker.indexOf('\n', normalizedStartIndex) + 1
  const normalizedEndIndex = withUpdatedStartMarker.indexOf(OCODE_BLOCK_END)
  const normalizedInsertionEnd = withUpdatedStartMarker.lastIndexOf(
    '\n',
    normalizedEndIndex,
  )

  const patchedSource =
    withUpdatedStartMarker.slice(0, normalizedInsertionStart) +
    `${generated}\n` +
    withUpdatedStartMarker.slice(normalizedInsertionEnd + 1)
  const changedLineCount = countChangedLines(source, patchedSource)

  if (changedLineCount === 0) {
    return {
      applied: true,
      patchedSource,
      changedLineCount,
      reason: 'No changes detected between source block and generated block.',
    }
  }

  return {
    applied: true,
    patchedSource,
    changedLineCount,
  }
}

export function getPatchTemplateSource(): string {
  const initialBlock = '      <div>replace me</div>\n'
  return [
    "import React from 'react'",
    '',
    'export function TargetCanvas() {',
    '  return (',
    '    <div className="relative h-[1200px] w-[1600px]">',
    `      ${OCODE_BLOCK_START_PREFIX} hash:${checksum(initialBlock)} */`,
    '      <div>replace me</div>',
    `      ${OCODE_BLOCK_END}`,
    '    </div>',
    '  )',
    '}',
    '',
  ].join('\n')
}

export function validateSyncState(state: EditorState): SyncValidation {
  const errors: string[] = []
  const warnings: string[] = []

  const uniqueRootIds = new Set<string>()
  state.rootIds.forEach((id) => {
    if (uniqueRootIds.has(id)) {
      errors.push(`Duplicate root id detected: ${id}`)
      return
    }
    uniqueRootIds.add(id)

    const node = state.nodeMap[id]
    if (!node) {
      errors.push(`Root id is missing in nodeMap: ${id}`)
      return
    }

    if (node.width <= 0 || node.height <= 0) {
      errors.push(`Invalid dimensions for node ${id}`)
    }
    if (node.width > 2000 || node.height > 2000) {
      warnings.push(`Large dimensions for node ${id}`)
    }
    if ((node.className ?? '').length > 220) {
      warnings.push(`Long className for node ${id}`)
    }
  })

  state.selectedIds.forEach((id) => {
    if (!state.nodeMap[id]) {
      warnings.push(`Selected node not found: ${id}`)
    }
  })

  return { errors, warnings }
}

function parseStyleLiteral(styleLiteral: string): Record<string, string | number> {
  const output: Record<string, string | number> = {}
  const entries = styleLiteral
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  entries.forEach((entry) => {
    const separator = entry.indexOf(':')
    if (separator <= 0) {
      return
    }
    const rawKey = entry.slice(0, separator).trim()
    const rawValue = entry.slice(separator + 1).trim()
    const key = rawKey.replace(/^['"]|['"]$/g, '')
    const unquoted = rawValue.replace(/^['"]|['"]$/g, '')
    const numeric = Number(unquoted)
    output[key] = Number.isFinite(numeric) && /^-?\d+(\.\d+)?$/.test(unquoted) ? numeric : unquoted
  })

  return output
}

function getAttrValue(attrs: string, name: string): string | undefined {
  const regex = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|\\{\\s*"([^"]*)"\\s*\\})`)
  const matched = attrs.match(regex)
  return matched?.[1] ?? matched?.[2]
}

function inferNodeType(raw: string | undefined): EditorNode['type'] {
  switch (raw) {
    case 'text':
    case 'button':
    case 'image':
    case 'frame':
      return raw
    default:
      return 'text'
  }
}

export function parseSourceToStateFallback(source: string): CodeParseResult {
  const divRegex = /<div\s+([^>]*data-node-type\s*=\s*(?:"[^"]*"|\{\s*"[^"]*"\s*\})[^>]*)>([\s\S]*?)<\/div>/g
  const nodes: EditorNode[] = []
  let matched: RegExpExecArray | null = divRegex.exec(source)
  let index = 0

  while (matched) {
    const attrs = matched[1] ?? ''
    const content = matched[2] ?? ''
    const type = inferNodeType(getAttrValue(attrs, 'data-node-type'))
    const id = getAttrValue(attrs, 'key') ?? `${type}-${index + 1}`
    const className = getAttrValue(attrs, 'className') ?? ''
    const src = getAttrValue(attrs, 'data-src') ?? ''
    const styleRawMatch = attrs.match(/style\s*=\s*\{\{([\s\S]*?)\}\}/)
    const styleObject = parseStyleLiteral(styleRawMatch?.[1] ?? '')
    const style: Record<string, string> = {}

    Object.entries(styleObject).forEach(([key, value]) => {
      if (key === 'left' || key === 'top' || key === 'width' || key === 'minHeight') {
        return
      }
      style[key] = String(value)
    })

    const text = content
      .replace(/<[^>]+>/g, ' ')
      .replace(/\{\s*"([^"]*)"\s*\}/g, ' $1 ')
      .replace(/\s+/g, ' ')
      .trim()

    nodes.push({
      id,
      type,
      name: `${type}-${index + 1}`,
      text,
      className,
      src,
      style,
      x: Number(styleObject.left ?? 0),
      y: Number(styleObject.top ?? 0),
      width: Math.max(1, Number(styleObject.width ?? 200)),
      height: Math.max(1, Number(styleObject.minHeight ?? 60)),
    })

    index += 1
    matched = divRegex.exec(source)
  }

  if (nodes.length === 0) {
    return { ok: false, reason: 'Fallback import found no parseable nodes.' }
  }

  const nodeMap = nodes.reduce<Record<string, EditorNode>>((acc, node) => {
    acc[node.id] = node
    return acc
  }, {})
  const rootIds = nodes.map((node) => node.id)
  const selectedId = rootIds[0] ?? null

  return {
    ok: true,
    state: {
      nodeMap,
      rootIds,
      selectedId,
      selectedIds: selectedId ? [selectedId] : [],
      viewport: DEFAULT_VIEWPORT,
    },
  }
}

export function createSemanticDiffSummary(
  baselineState: EditorState,
  nextState: EditorState,
): SemanticDiffSummary {
  const baselineIds = new Set(baselineState.rootIds)
  const nextIds = new Set(nextState.rootIds)

  let added = 0
  let removed = 0
  let moved = 0
  let resized = 0
  let textChanged = 0
  let styleChanged = 0

  nextState.rootIds.forEach((id) => {
    if (!baselineIds.has(id)) {
      added += 1
      return
    }
    const prevNode = baselineState.nodeMap[id]
    const nextNode = nextState.nodeMap[id]
    if (!prevNode || !nextNode) {
      return
    }
    if (prevNode.x !== nextNode.x || prevNode.y !== nextNode.y) {
      moved += 1
    }
    if (prevNode.width !== nextNode.width || prevNode.height !== nextNode.height) {
      resized += 1
    }
    if ((prevNode.text ?? '') !== (nextNode.text ?? '')) {
      textChanged += 1
    }
    if (
      (prevNode.className ?? '') !== (nextNode.className ?? '') ||
      JSON.stringify(prevNode.style ?? {}) !== JSON.stringify(nextNode.style ?? {})
    ) {
      styleChanged += 1
    }
  })

  baselineState.rootIds.forEach((id) => {
    if (!nextIds.has(id)) {
      removed += 1
    }
  })

  return {
    added,
    removed,
    moved,
    resized,
    textChanged,
    styleChanged,
  }
}
