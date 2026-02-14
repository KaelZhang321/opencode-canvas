import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { StateManager } from '../state-manager.js'

export function registerCanvasResources(mcp: McpServer, stateManager: StateManager): void {
  mcp.registerResource('canvas-state', 'canvas://state', {
    description: 'Complete canvas editor state including all nodes, root ordering, selection, and viewport.',
    mimeType: 'application/json',
  }, async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: 'application/json',
      text: JSON.stringify(stateManager.getState()),
    }],
  }))

  mcp.registerResource('canvas-selection', 'canvas://selection', {
    description: 'Currently selected nodes with full detail (position, size, style, etc.).',
    mimeType: 'application/json',
  }, async (uri) => {
    const state = stateManager.getState()
    const selectedNodes = state.selectedIds
      .map((id) => state.nodeMap[id])
      .filter(Boolean)
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify({
          selectedIds: state.selectedIds,
          nodes: selectedNodes,
        }),
      }],
    }
  })

  mcp.registerResource('canvas-tree', 'canvas://tree', {
    description: 'Simplified node tree showing hierarchy with name and type only.',
    mimeType: 'application/json',
  }, async (uri) => {
    const state = stateManager.getState()

    interface TreeNode {
      id: string
      type: string
      name: string
      children?: TreeNode[]
    }

    function buildTree(nodeId: string): TreeNode | null {
      const node = state.nodeMap[nodeId]
      if (!node) return null
      const tree: TreeNode = { id: node.id, type: node.type, name: node.name }
      if (node.children && node.children.length > 0) {
        tree.children = node.children
          .map((cid) => buildTree(cid))
          .filter((n): n is TreeNode => n !== null)
      }
      return tree
    }

    const tree = state.rootIds
      .map((id) => buildTree(id))
      .filter((n): n is TreeNode => n !== null)

    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(tree),
      }],
    }
  })
}
