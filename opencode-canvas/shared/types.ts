export type NodeType = 'frame' | 'text' | 'button' | 'image' | 'card' | 'form'

export interface EditorNode {
  id: string
  type: NodeType
  name: string
  x: number
  y: number
  width: number
  height: number
  text?: string
  className?: string
  style?: Record<string, string>
  src?: string
  locked?: boolean
  visible?: boolean
  /** Child node IDs (for frame containers) */
  children?: string[]
  /** Parent node ID (set when inside a frame) */
  parentId?: string
  /** Flexbox layout mode for frame containers */
  layoutMode?: 'none' | 'flex-row' | 'flex-column'
  /** Flex gap in px (frame containers only) */
  layoutGap?: number
  /** Flex align-items (frame containers only) */
  layoutAlign?: 'start' | 'center' | 'end' | 'stretch'
  /** Flex justify-content (frame containers only) */
  layoutJustify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around'
  /** Padding for frame containers [top, right, bottom, left] */
  layoutPadding?: [number, number, number, number]
}

export interface Viewport {
  /** Pan offset X in screen pixels */
  panX: number
  /** Pan offset Y in screen pixels */
  panY: number
  /** Zoom level (1.0 = 100%) */
  zoom: number
}

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 5.0
export const DEFAULT_VIEWPORT: Viewport = { panX: 0, panY: 0, zoom: 1 }

export interface EditorState {
  nodeMap: Record<string, EditorNode>
  rootIds: string[]
  selectedId: string | null
  selectedIds: string[]
  viewport: Viewport
}
