import { useEffect, useRef } from 'react'
import { useEditorStore } from './editor-store/store'
import { useWsSync } from './ws-sync'
import type { WsClientStatus } from './ws-client'

interface WsSyncBridgeProps {
  enabled?: boolean
  onStatusChange?: (status: WsClientStatus) => void
}

export function WsSyncBridge({ enabled = true, onStatusChange }: WsSyncBridgeProps) {
  const { restoreState } = useEditorStore()
  const restoreRef = useRef(restoreState)
  useEffect(() => {
    restoreRef.current = restoreState
  })

  const { status } = useWsSync({
    enabled,
    onFullState: (serverState) => {
      restoreRef.current(serverState)
    },
    onPatchState: (_command, result) => {
      restoreRef.current(result)
    },
  })

  const prevStatusRef = useRef(status)
  useEffect(() => {
    if (prevStatusRef.current !== status) {
      prevStatusRef.current = status
      onStatusChange?.(status)
    }
  }, [status, onStatusChange])

  return null
}
