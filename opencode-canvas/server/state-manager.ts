import type { EditorNode, EditorState } from '../shared/types.js'
import { applyCommand, sanitizeNode, snapToGrid } from '../shared/commands.js'
import type { EditorCommand } from '../shared/commands.js'

const MAX_HISTORY = 100

interface HistoryEntry {
  state: EditorState
  timestamp: number
  source: 'mcp' | 'browser'
}

export interface BatchOperation {
  op: 'add' | 'update' | 'delete' | 'move' | 'resize' | 'reparent'
  node?: {
    type: EditorNode['type']
    name: string
    x?: number
    y?: number
    width?: number
    height?: number
    text?: string
    className?: string
    style?: Record<string, string>
    parentId?: string
  }
  nodeId?: string
  changes?: Record<string, unknown>
  x?: number
  y?: number
  width?: number
  height?: number
  newParentId?: string | null
}

export interface BatchResult {
  state: EditorState
  commands: EditorCommand[]
  summary: string
  success: boolean
  errors: string[]
}

let nextId = 1

function generateId(): string {
  return `node_${Date.now()}_${nextId++}`
}

function createEmptyState(): EditorState {
  return {
    nodeMap: {},
    rootIds: [],
    selectedId: null,
    selectedIds: [],
    viewport: { panX: 0, panY: 0, zoom: 1 },
  }
}

export class StateManager {
  private _state: EditorState
  private _undoStack: HistoryEntry[] = []
  private _redoStack: HistoryEntry[] = []
  private _listeners: Set<(state: EditorState, commands: EditorCommand[]) => void> = new Set()

  constructor(initialState?: EditorState) {
    this._state = initialState ?? createEmptyState()
  }

  getState(): EditorState {
    return this._state
  }

  /**
   * Apply a single command, push to history, notify listeners.
   */
  applyCommand(command: EditorCommand, source: 'mcp' | 'browser' = 'mcp'): EditorState {
    const prev = this._state
    const next = applyCommand(prev, command)
    if (next === prev) return prev // no-op

    this._pushHistory(prev, source)
    this._state = next
    this._redoStack = []
    this._notifyListeners([command])
    return next
  }

  /**
   * Apply batch operations (from batch_design tool).
   * If atomic=true, all operations must succeed or none are applied.
   */
  applyBatch(operations: BatchOperation[], atomic: boolean = true): BatchResult {
    const commands: EditorCommand[] = []
    const errors: string[] = []
    const summaryParts: string[] = []

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i]
      try {
        const cmd = this._operationToCommand(op)
        if (cmd) {
          commands.push(cmd)
          summaryParts.push(this._describeOp(op))
        }
      } catch (err) {
        const msg = `Operation ${i} (${op.op}): ${err instanceof Error ? err.message : String(err)}`
        errors.push(msg)
        if (atomic) {
          return {
            state: this._state,
            commands: [],
            summary: `Atomic batch failed: ${msg}`,
            success: false,
            errors,
          }
        }
      }
    }

    if (commands.length === 0) {
      return {
        state: this._state,
        commands: [],
        summary: errors.length > 0 ? `All operations failed: ${errors.join('; ')}` : 'No operations to apply',
        success: errors.length === 0,
        errors,
      }
    }

    const prevState = this._state
    this._pushHistory(prevState, 'mcp')

    let current = this._state
    for (const cmd of commands) {
      current = applyCommand(current, cmd)
    }

    this._state = current
    this._redoStack = []
    this._notifyListeners(commands)

    const summary = summaryParts.join('; ')
    return {
      state: this._state,
      commands,
      summary: errors.length > 0
        ? `Partial success (${commands.length}/${operations.length}): ${summary}. Errors: ${errors.join('; ')}`
        : `${commands.length} operation(s) applied: ${summary}`,
      success: errors.length === 0,
      errors,
    }
  }

  undo(): EditorState | null {
    const entry = this._undoStack.pop()
    if (!entry) return null

    this._redoStack.push({
      state: this._state,
      timestamp: Date.now(),
      source: entry.source,
    })

    this._state = entry.state
    this._notifyListeners([])
    return this._state
  }

  redo(): EditorState | null {
    const entry = this._redoStack.pop()
    if (!entry) return null

    this._undoStack.push({
      state: this._state,
      timestamp: Date.now(),
      source: entry.source,
    })

    this._state = entry.state
    this._notifyListeners([])
    return this._state
  }

  /**
   * Replace the full state (used for browser state sync override).
   */
  replaceState(state: EditorState, source: 'mcp' | 'browser' = 'mcp'): void {
    this._pushHistory(this._state, source)
    this._state = state
    this._redoStack = []
    this._notifyListeners([])
  }

  onStateChange(listener: (state: EditorState, commands: EditorCommand[]) => void): () => void {
    this._listeners.add(listener)
    return () => {
      this._listeners.delete(listener)
    }
  }

  get historyInfo(): { undoCount: number; redoCount: number } {
    return {
      undoCount: this._undoStack.length,
      redoCount: this._redoStack.length,
    }
  }


  private _pushHistory(state: EditorState, source: 'mcp' | 'browser'): void {
    this._undoStack.push({ state, timestamp: Date.now(), source })
    if (this._undoStack.length > MAX_HISTORY) {
      this._undoStack.shift()
    }
  }

  private _notifyListeners(commands: EditorCommand[]): void {
    for (const listener of this._listeners) {
      try {
        listener(this._state, commands)
      } catch {
        // Listeners must not throw
      }
    }
  }

  private _operationToCommand(op: BatchOperation): EditorCommand | null {
    switch (op.op) {
      case 'add': {
        if (!op.node) throw new Error('Missing node for add operation')
        const id = generateId()
        const raw: EditorNode = {
          id,
          type: op.node.type,
          name: op.node.name,
          x: snapToGrid(op.node.x ?? 0),
          y: snapToGrid(op.node.y ?? 0),
          width: Math.max(1, op.node.width ?? 200),
          height: Math.max(1, op.node.height ?? 100),
          text: op.node.text,
          className: op.node.className,
          style: op.node.style,
        }
        const sanitized = sanitizeNode(raw)
        if (!sanitized) throw new Error(`Invalid node type: ${op.node.type}`)
        return { type: 'add', payload: { node: sanitized } }
      }

      case 'update': {
        if (!op.nodeId) throw new Error('Missing nodeId for update operation')
        if (!op.changes) throw new Error('Missing changes for update operation')
        if (!this._state.nodeMap[op.nodeId]) throw new Error(`Node not found: ${op.nodeId}`)
        const patch: Partial<EditorNode> = {}
        for (const [key, value] of Object.entries(op.changes)) {
          if (key === 'id' || key === 'type') continue
          ;(patch as Record<string, unknown>)[key] = value
        }
        return { type: 'updateMany', payload: { ids: [op.nodeId], patch } }
      }

      case 'delete': {
        if (!op.nodeId) throw new Error('Missing nodeId for delete operation')
        if (!this._state.nodeMap[op.nodeId]) throw new Error(`Node not found: ${op.nodeId}`)
        return { type: 'removeMany', payload: { ids: [op.nodeId] } }
      }

      case 'move': {
        if (!op.nodeId) throw new Error('Missing nodeId for move operation')
        if (op.x === undefined || op.y === undefined) throw new Error('Missing x/y for move operation')
        if (!this._state.nodeMap[op.nodeId]) throw new Error(`Node not found: ${op.nodeId}`)
        return { type: 'move', payload: { id: op.nodeId, x: op.x, y: op.y } }
      }

      case 'resize': {
        if (!op.nodeId) throw new Error('Missing nodeId for resize operation')
        if (op.width === undefined || op.height === undefined) throw new Error('Missing width/height for resize operation')
        if (!this._state.nodeMap[op.nodeId]) throw new Error(`Node not found: ${op.nodeId}`)
        return {
          type: 'updateMany',
          payload: {
            ids: [op.nodeId],
            patch: { width: op.width, height: op.height },
          },
        }
      }

      case 'reparent': {
        if (!op.nodeId) throw new Error('Missing nodeId for reparent operation')
        if (!this._state.nodeMap[op.nodeId]) throw new Error(`Node not found: ${op.nodeId}`)
        if (op.newParentId === null || op.newParentId === undefined) {
          return { type: 'removeFromFrame', payload: { nodeId: op.nodeId } }
        }
        if (!this._state.nodeMap[op.newParentId]) throw new Error(`Parent node not found: ${op.newParentId}`)
        return { type: 'addToFrame', payload: { nodeId: op.nodeId, frameId: op.newParentId } }
      }

      default:
        throw new Error(`Unknown operation: ${(op as BatchOperation).op}`)
    }
  }

  private _describeOp(op: BatchOperation): string {
    switch (op.op) {
      case 'add': return `added ${op.node?.type ?? 'node'} "${op.node?.name ?? 'unnamed'}"`
      case 'update': return `updated node ${op.nodeId}`
      case 'delete': return `deleted node ${op.nodeId}`
      case 'move': return `moved node ${op.nodeId} to (${op.x}, ${op.y})`
      case 'resize': return `resized node ${op.nodeId} to ${op.width}x${op.height}`
      case 'reparent': return `reparented node ${op.nodeId} → ${op.newParentId ?? 'root'}`
      default: return `unknown op`
    }
  }
}
