import { useEffect, useRef, useState, useCallback } from 'react'
import { WsClient, WS_URL } from './ws-client'
import type { WsClientStatus } from './ws-client'
import type { ServerMessage } from '../../shared/protocol'
import type { EditorState } from './editor-store/types'
import type { EditorCommand } from '../../shared/commands'

export interface UseWsSyncOptions {
  enabled?: boolean
  url?: string
  onFullState?: (state: EditorState) => void
  onPatchState?: (command: EditorCommand, result: EditorState) => void
  onCodeUpdate?: (files: Record<string, string>) => void
  onScreenshotRequest?: (requestId: string, frameId?: string) => void
}

export interface UseWsSyncReturn {
  status: WsClientStatus
  sendEdit: (command: EditorCommand) => void
  sendSelection: (selectedIds: string[]) => void
  sendScreenshotResponse: (requestId: string, dataUrl: string) => void
  clientRef: React.RefObject<WsClient | null>
}

export function useWsSync(options: UseWsSyncOptions = {}): UseWsSyncReturn {
  const {
    enabled = true,
    url = WS_URL,
    onFullState,
    onPatchState,
    onCodeUpdate,
    onScreenshotRequest,
  } = options

  const [status, setStatus] = useState<WsClientStatus>('disconnected')
  const clientRef = useRef<WsClient | null>(null)

  const callbacksRef = useRef({ onFullState, onPatchState, onCodeUpdate, onScreenshotRequest })
  useEffect(() => {
    callbacksRef.current = { onFullState, onPatchState, onCodeUpdate, onScreenshotRequest }
  })

  useEffect(() => {
    if (!enabled) return

    const client = new WsClient({
      url,
      onStatusChange: setStatus,
      onMessage: (msg: ServerMessage) => {
        const cbs = callbacksRef.current
        switch (msg.type) {
          case 'state:full':
            cbs.onFullState?.(msg.payload)
            break
          case 'state:patch':
            cbs.onPatchState?.(msg.payload.command, msg.payload.result)
            break
          case 'code:update':
            cbs.onCodeUpdate?.(msg.payload.files)
            break
          case 'request:screenshot':
            cbs.onScreenshotRequest?.(msg.payload.requestId, msg.payload.frameId)
            break
        }
      },
    })

    clientRef.current = client
    client.connect()

    return () => {
      client.dispose()
      clientRef.current = null
    }
  }, [enabled, url])

  const sendEdit = useCallback((command: EditorCommand) => {
    clientRef.current?.sendEdit(command)
  }, [])

  const sendSelection = useCallback((selectedIds: string[]) => {
    clientRef.current?.sendSelection(selectedIds)
  }, [])

  const sendScreenshotResponse = useCallback((requestId: string, dataUrl: string) => {
    clientRef.current?.sendScreenshotResponse(requestId, dataUrl)
  }, [])

  return { status, sendEdit, sendSelection, sendScreenshotResponse, clientRef }
}
