// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WebSocketServer, WebSocket } from 'ws'
import { StateManager } from './state-manager'
import { WSBridge } from './ws-bridge'
import { GRID_SIZE } from '../shared/commands'
import type { EditorState } from '../shared/types'
import type { ServerMessage, ClientMessage } from '../shared/protocol'

function snap(v: number): number {
  return Math.round(v / GRID_SIZE) * GRID_SIZE
}

function getRandomPort(): number {
  return 30000 + Math.floor(Math.random() * 10000)
}

/**
 * Buffered WS client that registers `message` listener BEFORE `open` resolves,
 * preventing the race where messages arrive between `await connect` and
 * `await waitForMessage`.
 */
interface BufferedClient {
  ws: WebSocket
  messages: ServerMessage[]
  waitForCount(count: number, timeout?: number): Promise<void>
  close(): void
}

function createClient(port: number): Promise<BufferedClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`)
    const messages: ServerMessage[] = []
    const waiters: Array<{ count: number; resolve: () => void }> = []

    ws.on('message', (data) => {
      messages.push(JSON.parse(String(data)) as ServerMessage)
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (messages.length >= waiters[i].count) {
          waiters[i].resolve()
          waiters.splice(i, 1)
        }
      }
    })

    ws.on('open', () => {
      resolve({
        ws,
        messages,
        waitForCount(count: number, timeout = 3000): Promise<void> {
          if (messages.length >= count) return Promise.resolve()
          return new Promise<void>((res, rej) => {
            const timer = setTimeout(() => rej(new Error(`Timed out waiting for ${count} messages, got ${messages.length}`)), timeout)
            waiters.push({
              count,
              resolve() {
                clearTimeout(timer)
                res()
              },
            })
          })
        },
        close() {
          ws.terminate()
        },
      })
    })

    ws.on('error', reject)
  })
}

describe('StateManager', () => {
  let sm: StateManager

  beforeEach(() => {
    sm = new StateManager()
  })

  it('starts with empty state', () => {
    const s = sm.getState()
    expect(Object.keys(s.nodeMap)).toHaveLength(0)
    expect(s.rootIds).toHaveLength(0)
    expect(s.selectedId).toBeNull()
  })

  it('applyBatch adds nodes', () => {
    const result = sm.applyBatch([
      { op: 'add', node: { type: 'frame', name: 'Frame1', x: 0, y: 0, width: 200, height: 100 } },
      { op: 'add', node: { type: 'text', name: 'Label', x: 10, y: 10, width: 100, height: 30, text: 'Hello' } },
    ])

    expect(result.success).toBe(true)
    expect(result.commands).toHaveLength(2)
    const nodeIds = Object.keys(result.state.nodeMap)
    expect(nodeIds).toHaveLength(2)
    expect(result.state.rootIds).toHaveLength(2)
  })

  it('applyBatch update and delete', () => {
    const addResult = sm.applyBatch([
      { op: 'add', node: { type: 'button', name: 'Btn', x: 0, y: 0, width: 80, height: 40 } },
    ])
    const nodeId = Object.keys(addResult.state.nodeMap)[0]

    const updateResult = sm.applyBatch([
      { op: 'update', nodeId, changes: { name: 'Updated Btn', text: 'Click me' } },
    ])
    expect(updateResult.success).toBe(true)
    expect(updateResult.state.nodeMap[nodeId].name).toBe('Updated Btn')

    const deleteResult = sm.applyBatch([{ op: 'delete', nodeId }])
    expect(deleteResult.success).toBe(true)
    expect(Object.keys(deleteResult.state.nodeMap)).toHaveLength(0)
  })

  it('applyBatch move and resize', () => {
    const addResult = sm.applyBatch([
      { op: 'add', node: { type: 'card', name: 'Card1', x: 0, y: 0, width: 200, height: 100 } },
    ])
    const nodeId = Object.keys(addResult.state.nodeMap)[0]

    sm.applyBatch([{ op: 'move', nodeId, x: 96, y: 204 }])
    const afterMove = sm.getState()
    expect(afterMove.nodeMap[nodeId].x).toBe(snap(96))
    expect(afterMove.nodeMap[nodeId].y).toBe(snap(204))

    sm.applyBatch([{ op: 'resize', nodeId, width: 300, height: 150 }])
    const afterResize = sm.getState()
    expect(afterResize.nodeMap[nodeId].width).toBe(300)
    expect(afterResize.nodeMap[nodeId].height).toBe(150)
  })

  it('atomic batch rolls back on failure', () => {
    const result = sm.applyBatch([
      { op: 'add', node: { type: 'text', name: 'T1', x: 0, y: 0, width: 100, height: 50 } },
      { op: 'delete', nodeId: 'nonexistent' },
    ], true)

    expect(result.success).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(Object.keys(sm.getState().nodeMap)).toHaveLength(0)
  })

  it('undo/redo works', () => {
    sm.applyBatch([
      { op: 'add', node: { type: 'frame', name: 'F1', x: 0, y: 0, width: 200, height: 100 } },
    ])
    expect(Object.keys(sm.getState().nodeMap)).toHaveLength(1)

    const undone = sm.undo()
    expect(undone).not.toBeNull()
    expect(Object.keys(sm.getState().nodeMap)).toHaveLength(0)

    const redone = sm.redo()
    expect(redone).not.toBeNull()
    expect(Object.keys(sm.getState().nodeMap)).toHaveLength(1)
  })

  it('state change listeners are called', () => {
    const events: EditorState[] = []
    sm.onStateChange((state) => events.push(state))

    sm.applyBatch([
      { op: 'add', node: { type: 'text', name: 'T', x: 0, y: 0, width: 100, height: 50 } },
    ])

    expect(events).toHaveLength(1)
    expect(Object.keys(events[0].nodeMap)).toHaveLength(1)
  })

  it('historyInfo tracks counts', () => {
    expect(sm.historyInfo).toEqual({ undoCount: 0, redoCount: 0 })

    sm.applyBatch([
      { op: 'add', node: { type: 'frame', name: 'A', x: 0, y: 0, width: 100, height: 50 } },
    ])
    expect(sm.historyInfo.undoCount).toBe(1)

    sm.undo()
    expect(sm.historyInfo.redoCount).toBe(1)
  })
})

describe('WSBridge integration', () => {
  let wss: WebSocketServer
  let sm: StateManager
  let bridge: WSBridge
  let port: number

  beforeEach(async () => {
    port = getRandomPort()
    sm = new StateManager()
    wss = new WebSocketServer({ port })
    await new Promise<void>((resolve) => wss.on('listening', resolve))
    bridge = new WSBridge(wss, sm)
  })

  afterEach(() => {
    bridge.close()
  })

  it('sends full state on connect', { timeout: 5000 }, async () => {
    const c = await createClient(port)
    await c.waitForCount(1)
    expect(c.messages[0].type).toBe('state:full')
    expect((c.messages[0].payload as EditorState).nodeMap).toEqual({})
    c.close()
  })

  it('broadcasts state:patch when server changes state', { timeout: 5000 }, async () => {
    const c = await createClient(port)
    await c.waitForCount(1) // initial state:full

    sm.applyBatch([
      { op: 'add', node: { type: 'text', name: 'Hello', x: 0, y: 0, width: 100, height: 50 } },
    ])

    await c.waitForCount(2) // state:full + state:patch
    expect(c.messages[1].type).toBe('state:patch')
    c.close()
  })

  it('receives user:edit from browser client and applies it', { timeout: 5000 }, async () => {
    sm.applyBatch([
      { op: 'add', node: { type: 'button', name: 'B1', x: 0, y: 0, width: 80, height: 40 } },
    ])
    const nodeId = Object.keys(sm.getState().nodeMap)[0]

    const c = await createClient(port)
    await c.waitForCount(1) // initial state:full

    const editMsg: ClientMessage = {
      type: 'user:edit',
      payload: {
        command: { type: 'move', payload: { id: nodeId, x: 48, y: 60 } },
      },
    }
    c.ws.send(JSON.stringify(editMsg))

    await c.waitForCount(2) // state:full + state:patch from the edit
    expect(c.messages[1].type).toBe('state:patch')
    expect(sm.getState().nodeMap[nodeId].x).toBe(snap(48))
    expect(sm.getState().nodeMap[nodeId].y).toBe(snap(60))
    c.close()
  })

  it('receives user:selection from browser client', { timeout: 5000 }, async () => {
    sm.applyBatch([
      { op: 'add', node: { type: 'text', name: 'S1', x: 0, y: 0, width: 100, height: 50 } },
    ])
    const nodeId = Object.keys(sm.getState().nodeMap)[0]

    const c = await createClient(port)
    await c.waitForCount(1)

    const selMsg: ClientMessage = {
      type: 'user:selection',
      payload: { selectedIds: [nodeId] },
    }
    c.ws.send(JSON.stringify(selMsg))

    await c.waitForCount(2)
    expect(sm.getState().selectedIds).toContain(nodeId)
    c.close()
  })

  it('multiple clients both receive broadcasts', { timeout: 5000 }, async () => {
    const c1 = await createClient(port)
    const c2 = await createClient(port)
    await c1.waitForCount(1)
    await c2.waitForCount(1)

    sm.applyBatch([
      { op: 'add', node: { type: 'frame', name: 'F', x: 0, y: 0, width: 200, height: 100 } },
    ])

    await c1.waitForCount(2)
    await c2.waitForCount(2)
    expect(c1.messages[1].type).toBe('state:patch')
    expect(c2.messages[1].type).toBe('state:patch')

    c1.close()
    c2.close()
  })

  it('client count tracks connected clients', { timeout: 5000 }, async () => {
    expect(bridge.clientCount).toBe(0)

    const c1 = await createClient(port)
    await c1.waitForCount(1)
    expect(bridge.clientCount).toBe(1)

    const c2 = await createClient(port)
    await c2.waitForCount(1)
    expect(bridge.clientCount).toBe(2)

    c1.close()
    await new Promise((r) => setTimeout(r, 100))
    expect(bridge.clientCount).toBe(1)

    c2.close()
  })
})

describe('End-to-end: batch_design → WS broadcast', () => {
  let wss: WebSocketServer
  let sm: StateManager
  let bridge: WSBridge
  let port: number

  beforeEach(async () => {
    port = getRandomPort()
    sm = new StateManager()
    wss = new WebSocketServer({ port })
    await new Promise<void>((resolve) => wss.on('listening', resolve))
    bridge = new WSBridge(wss, sm)
  })

  afterEach(() => {
    bridge.close()
  })

  it('full workflow: add nodes → update → delete → undo, client receives all', { timeout: 8000 }, async () => {
    const c = await createClient(port)
    await c.waitForCount(1) // initial state:full

    // 1. Add two nodes (generates 2 state:patch messages)
    sm.applyBatch([
      { op: 'add', node: { type: 'frame', name: 'Container', x: 0, y: 0, width: 400, height: 300 } },
      { op: 'add', node: { type: 'text', name: 'Title', x: 10, y: 10, width: 200, height: 40, text: 'Hello World' } },
    ])
    await c.waitForCount(3) // 1 initial + 2 patches
    expect(c.messages[1].type).toBe('state:patch')
    expect(c.messages[2].type).toBe('state:patch')

    const state = sm.getState()
    const nodeIds = Object.keys(state.nodeMap)
    expect(nodeIds).toHaveLength(2)

    // 2. Update a node
    const textNodeId = nodeIds.find((id) => state.nodeMap[id].type === 'text')!
    sm.applyBatch([
      { op: 'update', nodeId: textNodeId, changes: { text: 'Updated Title' } },
    ])
    await c.waitForCount(4) // +1 patch
    expect(sm.getState().nodeMap[textNodeId].text).toBe('Updated Title')

    // 3. Delete the text node
    sm.applyBatch([{ op: 'delete', nodeId: textNodeId }])
    await c.waitForCount(5) // +1 patch
    expect(Object.keys(sm.getState().nodeMap)).toHaveLength(1)

    // 4. Undo → text node returns (undo broadcasts state:full since commands=[])
    sm.undo()
    await c.waitForCount(6) // +1 full
    expect(c.messages[5].type).toBe('state:full')
    expect(Object.keys(sm.getState().nodeMap)).toHaveLength(2)

    c.close()
  })

  it('browser edit and server batch interleave correctly', { timeout: 5000 }, async () => {
    sm.applyBatch([
      { op: 'add', node: { type: 'button', name: 'Btn', x: 0, y: 0, width: 100, height: 40 } },
    ])
    const nodeId = Object.keys(sm.getState().nodeMap)[0]

    const c = await createClient(port)
    await c.waitForCount(1) // initial full state

    // Browser moves the node
    const editMsg: ClientMessage = {
      type: 'user:edit',
      payload: { command: { type: 'move', payload: { id: nodeId, x: 204, y: 300 } } },
    }
    c.ws.send(JSON.stringify(editMsg))
    await c.waitForCount(2) // +1 patch from browser edit

    expect(sm.getState().nodeMap[nodeId].x).toBe(snap(204))

    // Server resizes the same node
    sm.applyBatch([{ op: 'resize', nodeId, width: 500, height: 200 }])
    await c.waitForCount(3) // +1 patch from server resize

    const finalNode = sm.getState().nodeMap[nodeId]
    expect(finalNode.x).toBe(snap(204))
    expect(finalNode.width).toBe(500)
    expect(finalNode.height).toBe(200)

    c.close()
  })
})
