import { createContext, createElement, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { EditorNode, EditorState, NodeType, Viewport } from './types'
import { DEFAULT_VIEWPORT, MAX_ZOOM, MIN_ZOOM } from './types'
import { applyCommand, snapToGrid } from '../../../shared/commands'
import type { EditorCommand } from '../../../shared/commands'

export { applyCommand, sanitizePatch, sanitizeNode } from '../../../shared/commands'
export type { EditorCommand } from '../../../shared/commands'

const HISTORY_LIMIT = 120

const initialState: EditorState = {
  nodeMap: {
    'text-1': {
      id: 'text-1',
      type: 'text',
      name: '标题',
      x: 80,
      y: 80,
      width: 360,
      height: 56,
      text: 'AI 前端画布',
      className: 'text-4xl font-semibold tracking-tight text-slate-100',
    },
    'button-1': {
      id: 'button-1',
      type: 'button',
      name: '主按钮',
      x: 80,
      y: 168,
      width: 180,
      height: 44,
      text: '生成布局',
      className:
        'rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400',
    },
  },
  rootIds: ['text-1', 'button-1'],
  selectedId: 'text-1',
  selectedIds: ['text-1'],
  viewport: DEFAULT_VIEWPORT,
}

function useEditorStoreState() {
  const [history, setHistory] = useState<{
    past: EditorState[]
    present: EditorState
    future: EditorState[]
  }>({
    past: [],
    present: initialState,
    future: [],
  })

  const state = history.present

  const selectedNode = useMemo(() => {
    if (!state.selectedId) {
      return null
    }
    return state.nodeMap[state.selectedId] ?? null
  }, [state.nodeMap, state.selectedId])

  const selectedNodes = useMemo(() => {
    return state.selectedIds
      .map((id) => state.nodeMap[id])
      .filter((node): node is EditorNode => Boolean(node))
  }, [state.nodeMap, state.selectedIds])

  const dispatchCommand = (command: EditorCommand) => {
    setHistory((prev) => {
      const nextPresent = applyCommand(prev.present, command)
      if (nextPresent === prev.present) {
        return prev
      }
      const nextPast = [...prev.past, prev.present]
      return {
        past: nextPast.slice(-HISTORY_LIMIT),
        present: nextPresent,
        future: [],
      }
    })
  }

  const selectNode = (id: string, additive = false) => {
    dispatchCommand({ type: 'select', payload: { id, additive } })
  }

  const selectAllNodes = () => {
    dispatchCommand({ type: 'selectAll', payload: { ids: state.rootIds } })
  }

  const clearSelection = () => {
    dispatchCommand({ type: 'clearSelection' })
  }

  const setSelection = (ids: string[], additive = false) => {
    dispatchCommand({ type: 'setSelection', payload: { ids, additive } })
  }

  const moveNode = (id: string, x: number, y: number) => {
    dispatchCommand({ type: 'move', payload: { id, x, y } })
  }

  const moveSelectedBy = (deltaX: number, deltaY: number) => {
    dispatchCommand({
      type: 'moveMany',
      payload: { ids: state.selectedIds, deltaX, deltaY },
    })
  }

  const updateSelectedText = (text: string) => {
    dispatchCommand({
      type: 'updateMany',
      payload: {
        ids: state.selectedIds,
        patch: { text },
      },
    })
  }

  const updateSelectedPatch = (patch: Partial<EditorNode>) => {
    dispatchCommand({
      type: 'updateMany',
      payload: {
        ids: state.selectedIds,
        patch,
      },
    })
  }

  const nextNodeId = (type: NodeType) => {
    let index = 1
    while (state.nodeMap[`${type}-${index}`]) {
      index += 1
    }
    return `${type}-${index}`
  }

  const addNode = (type: NodeType) => {
    const id = nextNodeId(type)
    const defaultsByType: Record<
      NodeType,
      Pick<EditorNode, 'name' | 'width' | 'height' | 'text' | 'className' | 'src'>
    > = {
      text: {
        name: '新建文本',
        width: 300,
        height: 48,
        text: '可编辑文本',
        className: 'text-2xl font-semibold text-slate-100',
        src: '',
      },
      button: {
        name: '新建按钮',
        width: 180,
        height: 44,
        text: '操作',
        className: 'rounded-lg bg-violet-400 px-4 py-2 text-sm font-medium text-slate-950',
        src: '',
      },
      frame: {
        name: '新建画框',
        width: 400,
        height: 300,
        text: '',
        className: 'border border-dashed border-slate-600',
        src: '',
      },
      image: {
        name: '新建图片',
        width: 240,
        height: 160,
        text: '',
        className: '',
        src: 'https://placehold.co/240x160/1e293b/64748b?text=Image',
      },
      card: {
        name: '新建卡片',
        width: 280,
        height: 200,
        text: '卡片标题',
        className: 'rounded-xl bg-slate-800 p-4',
        src: '',
      },
      form: {
        name: '新建表单',
        width: 320,
        height: 240,
        text: '表单',
        className: 'rounded-lg border border-slate-600 p-4',
        src: '',
      },
    }
    const defaults = defaultsByType[type]
    const node: EditorNode = {
      id,
      type,
      name: defaults.name,
      x: snapToGrid(96),
      y: snapToGrid(96 + state.rootIds.length * 84),
      width: defaults.width,
      height: defaults.height,
      text: defaults.text,
      className: defaults.className,
      src: defaults.src,
      locked: false,
      visible: true,
    }
    dispatchCommand({ type: 'add', payload: { node } })
  }

  const updateNode = (id: string, patch: Partial<EditorNode>) => {
    dispatchCommand({ type: 'updateMany', payload: { ids: [id], patch } })
  }

  const reorderRoots = (fromId: string, toId: string) => {
    dispatchCommand({ type: 'reorderRoots', payload: { fromId, toId } })
  }

  const removeSelectedNode = () => {
    dispatchCommand({ type: 'removeMany', payload: { ids: state.selectedIds } })
  }

  const setViewport = (viewport: Viewport) => {
    const nextViewport: Viewport = {
      panX: Number.isFinite(viewport.panX) ? viewport.panX : state.viewport.panX,
      panY: Number.isFinite(viewport.panY) ? viewport.panY : state.viewport.panY,
      zoom: Number.isFinite(viewport.zoom) ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewport.zoom)) : state.viewport.zoom,
    }
    setHistory((prev) => ({
      ...prev,
      present: { ...prev.present, viewport: nextViewport },
    }))
  }

  const panBy = (dx: number, dy: number) => {
    setViewport({
      panX: state.viewport.panX + dx,
      panY: state.viewport.panY + dy,
      zoom: state.viewport.zoom,
    })
  }

  const zoomTo = (nextZoom: number, centerX: number, centerY: number) => {
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom))
    const ratio = clampedZoom / state.viewport.zoom
    setViewport({
      panX: centerX - (centerX - state.viewport.panX) * ratio,
      panY: centerY - (centerY - state.viewport.panY) * ratio,
      zoom: clampedZoom,
    })
  }

  const resetViewport = () => {
    setViewport(DEFAULT_VIEWPORT)
  }

  const addToFrame = (nodeId: string, frameId: string) => {
    dispatchCommand({ type: 'addToFrame', payload: { nodeId, frameId } })
  }

  const removeFromFrame = (nodeId: string) => {
    dispatchCommand({ type: 'removeFromFrame', payload: { nodeId } })
  }

  const undo = () => {
    setHistory((prev) => {
      const last = prev.past[prev.past.length - 1]
      if (!last) {
        return prev
      }
      return {
        past: prev.past.slice(0, -1),
        present: last,
        future: [prev.present, ...prev.future].slice(0, HISTORY_LIMIT),
      }
    })
  }

  const redo = () => {
    setHistory((prev) => {
      const next = prev.future[0]
      if (!next) {
        return prev
      }
      return {
        past: [...prev.past, prev.present].slice(-HISTORY_LIMIT),
        present: next,
        future: prev.future.slice(1),
      }
    })
  }

  const restoreState = (next: EditorState) => {
    setHistory((prev) => ({
      past: [...prev.past, prev.present].slice(-HISTORY_LIMIT),
      present: {
        nodeMap: { ...next.nodeMap },
        rootIds: [...next.rootIds],
        selectedId: next.selectedId,
        selectedIds: [...next.selectedIds],
        viewport: next.viewport ?? DEFAULT_VIEWPORT,
      },
      future: [],
    }))
  }

  return {
    state,
    selectedNode,
    selectedNodes,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    selectNode,
    selectAllNodes,
    setSelection,
    clearSelection,
    moveNode,
    moveSelectedBy,
    updateSelectedText,
    updateSelectedPatch,
    updateNode,
    reorderRoots,
    addNode,
    removeSelectedNode,
    undo,
    redo,
    restoreState,
    setViewport,
    panBy,
    zoomTo,
    resetViewport,
    addToFrame,
    removeFromFrame,
  }
}

type EditorStore = ReturnType<typeof useEditorStoreState>

const EditorStoreContext = createContext<EditorStore | null>(null)

export function EditorStoreProvider({ children }: { children: ReactNode }) {
  const store = useEditorStoreState()
  return createElement(EditorStoreContext.Provider, { value: store }, children)
}

export function useEditorStore() {
  const context = useContext(EditorStoreContext)
  if (!context) {
    throw new Error('useEditorStore must be used within EditorStoreProvider')
  }
  return context
}
