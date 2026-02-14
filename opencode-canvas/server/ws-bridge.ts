import { WebSocketServer, WebSocket } from 'ws'
import type { EditorState } from '../shared/types.js'
import type { EditorCommand } from '../shared/commands.js'
import type { ServerMessage, ClientMessage } from '../shared/protocol.js'
import type { StateManager } from './state-manager.js'

export class WSBridge {
  private _wss: WebSocketServer
  private _stateManager: StateManager
  private _clients: Set<WebSocket> = new Set()

  constructor(wss: WebSocketServer, stateManager: StateManager) {
    this._wss = wss
    this._stateManager = stateManager

    this._wss.on('connection', (ws) => {
      this._clients.add(ws)
      this._sendTo(ws, {
        type: 'state:full',
        payload: this._stateManager.getState(),
        timestamp: Date.now(),
      })

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(String(data)) as ClientMessage
          this._handleClientMessage(ws, msg)
        } catch {
          // Malformed JSON from client — safe to ignore
        }
      })

      ws.on('close', () => {
        this._clients.delete(ws)
      })

      ws.on('error', () => {
        this._clients.delete(ws)
      })
    })

    this._stateManager.onStateChange((state, commands) => {
      this._broadcastFromServer(state, commands)
    })
  }

  broadcastFullState(state: EditorState): void {
    const msg: ServerMessage = {
      type: 'state:full',
      payload: state,
      timestamp: Date.now(),
    }
    this._broadcast(msg)
  }

  broadcastStateUpdate(state: EditorState, commands: EditorCommand[]): void {
    if (commands.length === 0) {
      this.broadcastFullState(state)
      return
    }
    for (const command of commands) {
      const msg: ServerMessage = {
        type: 'state:patch',
        payload: { command, result: state },
        timestamp: Date.now(),
      }
      this._broadcast(msg)
    }
  }

  broadcastCodeUpdate(files: Record<string, string>): void {
    const msg: ServerMessage = {
      type: 'code:update',
      payload: { files },
      timestamp: Date.now(),
    }
    this._broadcast(msg)
  }

  get clientCount(): number {
    return this._clients.size
  }

  close(): void {
    for (const client of this._clients) {
      client.close()
    }
    this._clients.clear()
    this._wss.close()
  }

  private _handleClientMessage(_sender: WebSocket, msg: ClientMessage): void {
    switch (msg.type) {
      case 'user:edit': {
        this._stateManager.applyCommand(msg.payload.command, 'browser')
        break
      }
      case 'user:selection': {
        const ids = msg.payload.selectedIds
        if (ids.length === 0) {
          this._stateManager.applyCommand({ type: 'clearSelection' }, 'browser')
        } else {
          this._stateManager.applyCommand(
            { type: 'setSelection', payload: { ids, additive: false } },
            'browser',
          )
        }
        break
      }
      case 'response:screenshot': {
        // Screenshot responses handled by pending promise resolution (future)
        break
      }
    }
  }

  private _broadcastFromServer(state: EditorState, commands: EditorCommand[]): void {
    this.broadcastStateUpdate(state, commands)
  }

  private _broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg)
    for (const client of this._clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data)
      }
    }
  }

  private _sendTo(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }
}
