import type { EditorCommand } from './commands'
import type { EditorState } from './types'

export type ServerMessage =
  | { type: 'state:full'; payload: EditorState; timestamp: number }
  | { type: 'state:patch'; payload: { command: EditorCommand; result: EditorState }; timestamp: number }
  | { type: 'code:update'; payload: { files: Record<string, string> }; timestamp: number }
  | { type: 'request:screenshot'; payload: { requestId: string; frameId?: string }; timestamp: number }

export type ClientMessage =
  | { type: 'user:edit'; payload: { command: EditorCommand } }
  | { type: 'response:screenshot'; payload: { requestId: string; dataUrl: string } }
  | { type: 'user:selection'; payload: { selectedIds: string[] } }

export type WsMessage = ServerMessage | ClientMessage
