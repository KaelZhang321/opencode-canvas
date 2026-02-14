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

function connectClient(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

function waitForMessage(ws: WebSocket): Promise<ServerMessage> {
  return new Promise((resolve) => {
    ws.once('message', (data) => {
      resolve(JSON.parse(String(data)) as ServerMessage)
    })
  })
}

function waitForMessages(ws: WebSocket, count: number, timeout = 2000): Promise<ServerMessage[]> {
  return new Promise((resolve, reject) => {
    const messages: ServerMessage[] = []
    const timer = setTimeout(() => {
      resolve(messages) // resolve with what we have
    }, timeout)
    const handler = (data: unknown) => {
      messages.push(JSON.parse(String(data)) as ServerMessage)
      if (messages.length >= count) {
        clearTimeout(timer)
        ws.off('message', handler)
        resolve(messages)
      }
    }
    ws.on('message', handler)
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

  afterEach(async () => {
    bridge.close()
    await new Promise<void>((resolve) => {
      wss.close(() => resolve())
    })
  })

  it('sends full state on connect', async () => {
    const ws = await connectClient(port)
    const msg = await waitForMessage(ws)
    expect(msg.type).toBe('state:full')
    expect((msg.payload as EditorState).nodeMap).toEqual({})
    ws.close()
  })

  it('broadcasts state:patch when server changes state', async () => {
    const ws = await connectClient(port)
    await waitForMessage(ws) // consume initial state:full

    const pendingMsg = waitForMessage(ws)
    sm.applyBatch([
      { op: 'add', node: { type: 'text', name: 'Hello', x: 0, y: 0, width: 100, height: 50 } },
    ])

    const msg = await pendingMsg
    expect(msg.type).toBe('state:patch')
    ws.close()
  })

  it('receives user:edit from browser client and applies it', async () => {
    sm.applyBatch([
      { op: 'add', node: { type: 'button', name: 'B1', x: 0, y: 0, width: 80, height: 40 } },
    ])
    const nodeId = Object.keys(sm.getState().nodeMap)[0]

    const ws = await connectClient(port)
    await waitForMessage(ws) // consume initial state:full (already includes the node)

    const pendingMsg = waitForMessage(ws)
    const editMsg: ClientMessage = {
      type: 'user:edit',
      payload: {
        command: { type: 'move', payload: { id: nodeId, x: 48, y: 60 } },
      },
    }
    ws.send(JSON.stringify(editMsg))

    const msg = await pendingMsg
    expect(msg.type).toBe('state:patch')
    expect(sm.getState().nodeMap[nodeId].x).toBe(snap(48))
    expect(sm.getState().nodeMap[nodeId].y).toBe(snap(60))
    ws.close()
  })

  it('receives user:selection from browser client', async () => {
    sm.applyBatch([
      { op: 'add', node: { type: 'text', name: 'S1', x: 0, y: 0, width: 100, height: 50 } },
    ])
    const nodeId = Object.keys(sm.getState().nodeMap)[0]

    const ws = await connectClient(port)
    await waitForMessage(ws)

    const pendingMsg = waitForMessage(ws)
    const selMsg: ClientMessage = {
      type: 'user:selection',
      payload: { selectedIds: [nodeId] },
    }
    ws.send(JSON.stringify(selMsg))

    await pendingMsg
    expect(sm.getState().selectedIds).toContain(nodeId)
    ws.close()
  })

  it('multiple clients both receive broadcasts', async () => {
    const ws1 = await connectClient(port)
    const ws2 = await connectClient(port)
    await waitForMessage(ws1) // initial
    await waitForMessage(ws2) // initial

    const p1 = waitForMessage(ws1)
    const p2 = waitForMessage(ws2)

    sm.applyBatch([
      { op: 'add', node: { type: 'frame', name: 'F', x: 0, y: 0, width: 200, height: 100 } },
    ])

    const [msg1, msg2] = await Promise.all([p1, p2])
    expect(msg1.type).toBe('state:patch')
    expect(msg2.type).toBe('state:patch')

    ws1.close()
    ws2.close()
  })

  it('client count tracks connected clients', async () => {
    expect(bridge.clientCount).toBe(0)

    const ws1 = await connectClient(port)
    await waitForMessage(ws1)
    expect(bridge.clientCount).toBe(1)

    const ws2 = await connectClient(port)
    await waitForMessage(ws2)
    expect(bridge.clientCount).toBe(2)

    ws1.close()
    await new Promise((r) => setTimeout(r, 100))
    expect(bridge.clientCount).toBe(1)

    ws2.close()
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

  afterEach(async () => {
    bridge.close()
    await new Promise<void>((resolve) => {
      wss.close(() => resolve())
    })
  })

  it('full workflow: add nodes → update → delete → undo, client receives all', async () => {
    const ws = await connectClient(port)
    await waitForMessage(ws) // initial

    // 1. Add two nodes
    let pending = waitForMessages(ws, 2)
    sm.applyBatch([
      { op: 'add', node: { type: 'frame', name: 'Container', x: 0, y: 0, width: 400, height: 300 } },
      { op: 'add', node: { type: 'text', name: 'Title', x: 10, y: 10, width: 200, height: 40, text: 'Hello World' } },
    ])
    let messages = await pending
    expect(messages).toHaveLength(2)
    messages.forEach((m) => expect(m.type).toBe('state:patch'))

    const state = sm.getState()
    const nodeIds = Object.keys(state.nodeMap)
    expect(nodeIds).toHaveLength(2)

    // 2. Update a node
    const textNodeId = nodeIds.find((id) => state.nodeMap[id].type === 'text')!
    pending = waitForMessages(ws, 1)
    sm.applyBatch([
      { op: 'update', nodeId: textNodeId, changes: { text: 'Updated Title' } },
    ])
    messages = await pending
    expect(messages).toHaveLength(1)
    expect(sm.getState().nodeMap[textNodeId].text).toBe('Updated Title')

    // 3. Delete the text node
    pending = waitForMessages(ws, 1)
    sm.applyBatch([{ op: 'delete', nodeId: textNodeId }])
    messages = await pending
    expect(messages).toHaveLength(1)
    expect(Object.keys(sm.getState().nodeMap)).toHaveLength(1)

    // 4. Undo → text node returns
    pending = waitForMessage(ws)
    sm.undo()
    const undoMsg = await pending
    expect(undoMsg.type).toBe('state:full') // undo broadcasts full state (empty commands)
    expect(Object.keys(sm.getState().nodeMap)).toHaveLength(2)

    ws.close()
  })

  it('browser edit and server batch interleave correctly', async () => {
    // Server adds a node
    sm.applyBatch([
      { op: 'add', node: { type: 'button', name: 'Btn', x: 0, y: 0, width: 100, height: 40 } },
    ])
    const nodeId = Object.keys(sm.getState().nodeMap)[0]

    const ws = await connectClient(port)
    await waitForMessage(ws) // initial full state

    // Browser moves the node
    let pending = waitForMessage(ws)
    const editMsg: ClientMessage = {
      type: 'user:edit',
      payload: { command: { type: 'move', payload: { id: nodeId, x: 204, y: 300 } } },
    }
    ws.send(JSON.stringify(editMsg))
    await pending

    expect(sm.getState().nodeMap[nodeId].x).toBe(snap(204))

    // Server resizes the same node
    pending = waitForMessage(ws)
    sm.applyBatch([{ op: 'resize', nodeId, width: 500, height: 200 }])
    await pending

    const finalNode = sm.getState().nodeMap[nodeId]
    expect(finalNode.x).toBe(snap(204))
    expect(finalNode.width).toBe(500)
    expect(finalNode.height).toBe(200)

    ws.close()
  })
})
