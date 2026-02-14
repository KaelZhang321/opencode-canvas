import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { StateManager } from '../state-manager.js'
import type { EditorNode, EditorState } from '../../shared/types.js'

export function registerQueryLayoutTool(mcp: McpServer, stateManager: StateManager): void {
  mcp.registerTool(
    'query_layout',
    {
      title: 'Query Layout',
      description:
        'Query node layout information by id, name pattern, or type. Returns position, size, hierarchy, and style data for matching nodes.',
      inputSchema: {
        selector: z
          .object({
            id: z.string().optional(),
            name: z.string().optional(),
            type: z
              .enum(['frame', 'text', 'button', 'image', 'card', 'form'])
              .optional(),
          })
          .describe(
            'At least one of id, name (substring match), or type must be provided.',
          ),
        includeChildren: z
          .boolean()
          .default(false)
          .describe('Include child nodes for frame containers.'),
      },
    },
    async (args) => {
      const state = stateManager.getState()
      const { selector, includeChildren } = args
      const matches = findMatchingNodes(state, selector)

      if (matches.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ matches: [], count: 0 }),
            },
          ],
        }
      }

      const results = matches.map((node) =>
        buildNodeInfo(node, state, includeChildren),
      )

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ matches: results, count: results.length }),
          },
        ],
      }
    },
  )
}

function findMatchingNodes(
  state: EditorState,
  selector: { id?: string; name?: string; type?: string },
): EditorNode[] {
  const allNodes = Object.values(state.nodeMap)
  return allNodes.filter((node) => {
    if (selector.id && node.id !== selector.id) return false
    if (selector.name && !node.name.includes(selector.name)) return false
    if (selector.type && node.type !== selector.type) return false
    return true
  })
}

function buildNodeInfo(
  node: EditorNode,
  state: EditorState,
  includeChildren: boolean,
): Record<string, unknown> {
  const info: Record<string, unknown> = {
    id: node.id,
    type: node.type,
    name: node.name,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    isRoot: state.rootIds.includes(node.id),
    parentId: node.parentId ?? null,
    locked: node.locked ?? false,
    visible: node.visible ?? true,
  }

  if (node.className) info.className = node.className
  if (node.text) info.text = node.text
  if (node.src) info.src = node.src
  if (node.style && Object.keys(node.style).length > 0) info.style = node.style
  if (node.layoutMode && node.layoutMode !== 'none') {
    info.layout = {
      mode: node.layoutMode,
      gap: node.layoutGap ?? 0,
      align: node.layoutAlign ?? 'start',
      justify: node.layoutJustify ?? 'start',
      padding: node.layoutPadding ?? [0, 0, 0, 0],
    }
  }

  if (includeChildren && node.children && node.children.length > 0) {
    info.children = node.children
      .map((childId) => state.nodeMap[childId])
      .filter(Boolean)
      .map((child) => ({
        id: child.id,
        type: child.type,
        name: child.name,
        x: child.x,
        y: child.y,
        width: child.width,
        height: child.height,
      }))
  }

  return info
}
