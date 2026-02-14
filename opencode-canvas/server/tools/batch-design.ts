import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { StateManager } from '../state-manager.js'
import type { BatchOperation } from '../state-manager.js'

const addOp = z.object({
  op: z.literal('add'),
  node: z.object({
    type: z.enum(['frame', 'text', 'button', 'image', 'card', 'form']),
    name: z.string(),
    x: z.number().default(0),
    y: z.number().default(0),
    width: z.number().default(200),
    height: z.number().default(100),
    text: z.string().optional(),
    className: z.string().optional(),
    style: z.record(z.string(), z.string()).optional(),
    parentId: z.string().optional(),
  }),
})

const updateOp = z.object({
  op: z.literal('update'),
  nodeId: z.string(),
  changes: z.record(z.string(), z.unknown()),
})

const deleteOp = z.object({
  op: z.literal('delete'),
  nodeId: z.string(),
})

const moveOp = z.object({
  op: z.literal('move'),
  nodeId: z.string(),
  x: z.number(),
  y: z.number(),
})

const resizeOp = z.object({
  op: z.literal('resize'),
  nodeId: z.string(),
  width: z.number(),
  height: z.number(),
})

const reparentOp = z.object({
  op: z.literal('reparent'),
  nodeId: z.string(),
  newParentId: z.string().nullable(),
})

export function registerBatchDesignTool(mcp: McpServer, stateManager: StateManager): void {
  mcp.registerTool('batch_design', {
    title: 'Batch Design Operations',
    description:
      'Create, update, delete, move, resize, or reparent design nodes on the canvas. ' +
      'Supports atomic transactions (all-or-nothing) via the `atomic` flag.',
    inputSchema: {
      operations: z.array(
        z.discriminatedUnion('op', [addOp, updateOp, deleteOp, moveOp, resizeOp, reparentOp]),
      ),
      atomic: z.boolean().default(true),
    },
  }, async (args) => {
    const operations = args.operations as unknown as BatchOperation[]
    const result = stateManager.applyBatch(operations, args.atomic)
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          success: result.success,
          summary: result.summary,
          errors: result.errors,
          nodeCount: Object.keys(result.state.nodeMap).length,
        }),
      }],
    }
  })
}
