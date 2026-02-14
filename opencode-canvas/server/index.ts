import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { WebSocketServer } from 'ws'
import { StateManager } from './state-manager.js'
import { WSBridge } from './ws-bridge.js'
import { registerBatchDesignTool } from './tools/batch-design.js'
import { registerQueryLayoutTool } from './tools/query-layout.js'
import { registerGenerateCodeTool } from './tools/generate-code.js'
import { registerCanvasResources } from './resources/canvas-state.js'

const WS_PORT = Number(process.env.CANVAS_WS_PORT ?? 3100)

const stateManager = new StateManager()

const wss = new WebSocketServer({ port: WS_PORT })
const wsBridge = new WSBridge(wss, stateManager)

const mcpServer = new McpServer({
  name: 'opencode-canvas',
  version: '1.0.0',
})

registerBatchDesignTool(mcpServer, stateManager)
registerQueryLayoutTool(mcpServer, stateManager)
registerGenerateCodeTool(mcpServer, stateManager)
registerCanvasResources(mcpServer, stateManager)

const transport = new StdioServerTransport()
await mcpServer.connect(transport)

console.error(`[opencode-canvas] MCP Server running (stdio)`)
console.error(`[opencode-canvas] WebSocket bridge on ws://localhost:${WS_PORT}`)
console.error(`[opencode-canvas] ${wsBridge.clientCount} client(s) connected`)

async function shutdown() {
  console.error('[opencode-canvas] Shutting down...')
  wsBridge.close()
  await mcpServer.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
