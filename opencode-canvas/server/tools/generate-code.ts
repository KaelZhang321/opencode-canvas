import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { StateManager } from '../state-manager.js'
import type { EditorNode, EditorState } from '../../shared/types.js'

export function registerGenerateCodeTool(mcp: McpServer, stateManager: StateManager): void {
  mcp.registerTool(
    'generate_code',
    {
      title: 'Generate Code',
      description:
        'Generate React component code from the current canvas state or a specific frame. Returns a complete, renderable React component file.',
      inputSchema: {
        frameId: z
          .string()
          .optional()
          .describe('Generate code for a specific frame and its children. If omitted, generates code for all root nodes.'),
        framework: z
          .enum(['react'])
          .default('react')
          .describe('Target framework. Currently only React is supported.'),
        styling: z
          .enum(['tailwind', 'inline'])
          .default('tailwind')
          .describe('Styling approach: tailwind classes or inline style objects.'),
      },
    },
    async (args) => {
      const state = stateManager.getState()
      const { frameId, styling } = args

      if (frameId) {
        const frame = state.nodeMap[frameId]
        if (!frame) {
          return {
            content: [{ type: 'text' as const, text: `Error: Node "${frameId}" not found.` }],
          }
        }
        if (frame.type !== 'frame') {
          return {
            content: [{ type: 'text' as const, text: `Error: Node "${frameId}" is not a frame (type: ${frame.type}).` }],
          }
        }
        const code = generateFrameComponent(frame, state, styling)
        return { content: [{ type: 'text' as const, text: code }] }
      }

      const code = generateFullCanvasComponent(state, styling)
      return { content: [{ type: 'text' as const, text: code }] }
    },
  )
}

function escapeJsx(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function escapeAttr(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

function styleObjectLiteral(node: EditorNode, absolute: boolean): string {
  const parts: string[] = []
  if (absolute) {
    parts.push('position: "absolute"')
    parts.push(`left: ${node.x}`)
    parts.push(`top: ${node.y}`)
  }
  parts.push(`width: ${node.width}`)
  parts.push(`minHeight: ${node.height}`)
  if (node.style) {
    for (const [key, value] of Object.entries(node.style)) {
      if (typeof value === 'string') {
        const safeKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key)
        parts.push(`${safeKey}: ${JSON.stringify(value)}`)
      }
    }
  }
  return `{{ ${parts.join(', ')} }}`
}

function renderNode(node: EditorNode, state: EditorState, styling: string, indent: string, absolute: boolean): string {
  const text = escapeJsx(node.text ?? node.name)
  const attrs: string[] = [`key="${escapeAttr(node.id)}"`]

  if (styling === 'tailwind') {
    const classes = [absolute ? 'absolute' : '', node.className ?? ''].filter(Boolean).join(' ')
    if (classes) attrs.push(`className="${escapeAttr(classes)}"`)
    attrs.push(`style={${styleObjectLiteral(node, absolute)}}`)
  } else {
    attrs.push(`style={${styleObjectLiteral(node, absolute)}}`)
  }

  if (node.type === 'image' && node.src) {
    attrs.push(`data-src="${escapeAttr(node.src)}"`)
  }

  const children = node.children ?? []
  if (children.length > 0) {
    const childLines = children
      .map((childId) => state.nodeMap[childId])
      .filter(Boolean)
      .map((child) => renderNode(child, state, styling, indent + '  ', false))
      .join('\n')
    return `${indent}<div ${attrs.join(' ')}>\n${childLines}\n${indent}</div>`
  }

  return `${indent}<div ${attrs.join(' ')}>${text}</div>`
}

function generateFullCanvasComponent(state: EditorState, styling: string): string {
  const nodes = state.rootIds
    .map((id) => state.nodeMap[id])
    .filter((n): n is EditorNode => Boolean(n))
    .map((node) => renderNode(node, state, styling, '      ', true))
    .join('\n')

  return [
    "import React from 'react'",
    '',
    'export default function CanvasPage() {',
    '  return (',
    '    <div className="relative w-full min-h-screen">',
    nodes,
    '    </div>',
    '  )',
    '}',
    '',
  ].join('\n')
}

function generateFrameComponent(frame: EditorNode, state: EditorState, styling: string): string {
  const componentName = toPascalCase(frame.name || 'Frame')

  const children = (frame.children ?? [])
    .map((id) => state.nodeMap[id])
    .filter((n): n is EditorNode => Boolean(n))
    .map((node) => renderNode(node, state, styling, '      ', false))
    .join('\n')

  const frameAttrs: string[] = []
  if (styling === 'tailwind' && frame.className) {
    frameAttrs.push(`className="${escapeAttr(frame.className)}"`)
  }
  frameAttrs.push(`style={${styleObjectLiteral(frame, false)}}`)

  return [
    "import React from 'react'",
    '',
    `export default function ${componentName}() {`,
    '  return (',
    `    <div ${frameAttrs.join(' ')}>`,
    children,
    '    </div>',
    '  )',
    '}',
    '',
  ].join('\n')
}

function toPascalCase(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
    || 'Component'
}
