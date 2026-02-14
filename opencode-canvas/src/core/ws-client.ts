import type { ServerMessage, ClientMessage } from '../../shared/protocol'
import type { EditorCommand } from '../../shared/commands'

export type WsClientStatus = 'disconnected' | 'connecting' | 'connected'

export interface WsClientOptions {
  url: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
  onMessage?: (msg: ServerMessage) => void
  onStatusChange?: (status: WsClientStatus) => void
}

const DEFAULT_RECONNECT_INTERVAL = 2000
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10

export class WsClient {
  private _ws: WebSocket | null = null
  private _status: WsClientStatus = 'disconnected'
  private _url: string
  private _reconnectInterval: number
  private _maxReconnectAttempts: number
  private _reconnectCount = 0
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private _onMessage: ((msg: ServerMessage) => void) | null
  private _onStatusChange: ((status: WsClientStatus) => void) | null
  private _disposed = false

  constructor(options: WsClientOptions) {
    this._url = options.url
    this._reconnectInterval = options.reconnectInterval ?? DEFAULT_RECONNECT_INTERVAL
    this._maxReconnectAttempts = options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS
    this._onMessage = options.onMessage ?? null
    this._onStatusChange = options.onStatusChange ?? null
  }

  get status(): WsClientStatus {
    return this._status
  }

  connect(): void {
    if (this._disposed) return
    if (this._ws) return

    this._setStatus('connecting')

    try {
      this._ws = new WebSocket(this._url)
    } catch {
      this._scheduleReconnect()
      return
    }

    this._ws.onopen = () => {
      this._reconnectCount = 0
      this._setStatus('connected')
    }

    this._ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as ServerMessage
        this._onMessage?.(msg)
      } catch {
        // Malformed JSON — ignore
      }
    }

    this._ws.onclose = () => {
      this._ws = null
      this._setStatus('disconnected')
      this._scheduleReconnect()
    }

    this._ws.onerror = () => {
      // onclose will fire after onerror, handle reconnect there
    }
  }

  disconnect(): void {
    this._clearReconnect()
    if (this._ws) {
      this._ws.onclose = null
      this._ws.onerror = null
      this._ws.onmessage = null
      this._ws.close()
      this._ws = null
    }
    this._setStatus('disconnected')
  }

  dispose(): void {
    this._disposed = true
    this.disconnect()
    this._onMessage = null
    this._onStatusChange = null
  }

  send(msg: ClientMessage): void {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(msg))
    }
  }

  sendEdit(command: EditorCommand): void {
    this.send({ type: 'user:edit', payload: { command } })
  }

  sendSelection(selectedIds: string[]): void {
    this.send({ type: 'user:selection', payload: { selectedIds } })
  }

  sendScreenshotResponse(requestId: string, dataUrl: string): void {
    this.send({ type: 'response:screenshot', payload: { requestId, dataUrl } })
  }

  private _setStatus(status: WsClientStatus): void {
    if (this._status !== status) {
      this._status = status
      this._onStatusChange?.(status)
    }
  }

  private _scheduleReconnect(): void {
    if (this._disposed) return
    if (this._reconnectCount >= this._maxReconnectAttempts) return

    this._clearReconnect()
    this._reconnectCount++
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null
      this.connect()
    }, this._reconnectInterval)
  }

  private _clearReconnect(): void {
    if (this._reconnectTimer !== null) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }
  }
}

let defaultWsUrl = `ws://localhost:3100`
if (typeof window !== 'undefined' && window.location) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  defaultWsUrl = `${proto}//${host}/ws`
}

export const WS_URL = defaultWsUrl
