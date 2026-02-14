import type { EditorNode, EditorState, NodeType } from './types'

export const ALLOWED_NODE_TYPES: NodeType[] = ['text', 'button', 'frame', 'image', 'card', 'form']
export const GRID_SIZE = 18

export function snapToGrid(value: number) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE
}

export function sanitizeNumber(value: unknown, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }
  return Math.round(value)
}

export function sanitizePatch(
  patch: Partial<EditorNode>,
  current: EditorNode,
): Partial<EditorNode> {
  const next: Partial<EditorNode> = {}

  if (typeof patch.name === 'string') {
    next.name = patch.name.slice(0, 80)
  }
  if (typeof patch.text === 'string') {
    next.text = patch.text.slice(0, 1000)
  }
  if (typeof patch.className === 'string') {
    next.className = patch.className.slice(0, 500)
  }
  if (patch.style && typeof patch.style === 'object') {
    const nextStyle: Record<string, string> = {}
    Object.entries(patch.style).forEach(([key, value]) => {
      if (typeof value === 'string') {
        nextStyle[key] = value
      }
    })
    next.style = {
      ...(current.style ?? {}),
      ...nextStyle,
    }
  }
  if (typeof patch.src === 'string') {
    next.src = patch.src.slice(0, 2000)
  }
  if (typeof patch.locked === 'boolean') {
    next.locked = patch.locked
  }
  if (typeof patch.visible === 'boolean') {
    next.visible = patch.visible
  }
  if (typeof patch.x === 'number') {
    next.x = sanitizeNumber(patch.x, current.x)
  }
  if (typeof patch.y === 'number') {
    next.y = sanitizeNumber(patch.y, current.y)
  }
  if (typeof patch.width === 'number') {
    next.width = Math.max(1, sanitizeNumber(patch.width, current.width))
  }
  if (typeof patch.height === 'number') {
    next.height = Math.max(1, sanitizeNumber(patch.height, current.height))
  }

  return next
}

export function sanitizeNode(node: EditorNode): EditorNode | null {
  if (!ALLOWED_NODE_TYPES.includes(node.type)) {
    return null
  }

  return {
    ...node,
    name: node.name.slice(0, 80),
    text: (node.text ?? '').slice(0, 1000),
    className: (node.className ?? '').slice(0, 500),
    style: node.style && typeof node.style === 'object' ? { ...node.style } : {},
    src: typeof node.src === 'string' ? node.src.slice(0, 2000) : '',
    locked: typeof node.locked === 'boolean' ? node.locked : false,
    visible: typeof node.visible === 'boolean' ? node.visible : true,
    x: sanitizeNumber(node.x, 0),
    y: sanitizeNumber(node.y, 0),
    width: Math.max(1, sanitizeNumber(node.width, 1)),
    height: Math.max(1, sanitizeNumber(node.height, 1)),
  }
}

export type EditorCommand =
  | { type: 'select'; payload: { id: string; additive: boolean } }
  | { type: 'selectAll'; payload: { ids: string[] } }
  | { type: 'setSelection'; payload: { ids: string[]; additive: boolean } }
  | { type: 'clearSelection' }
  | { type: 'move'; payload: { id: string; x: number; y: number } }
  | {
    type: 'moveMany'
    payload: { ids: string[]; deltaX: number; deltaY: number }
  }
  | {
    type: 'updateMany'
    payload: { ids: string[]; patch: Partial<EditorNode> }
  }
  | { type: 'reorderRoots'; payload: { fromId: string; toId: string } }
  | { type: 'add'; payload: { node: EditorNode } }
  | { type: 'removeMany'; payload: { ids: string[] } }
  | { type: 'addToFrame'; payload: { nodeId: string; frameId: string } }
  | { type: 'removeFromFrame'; payload: { nodeId: string } }

export function applyCommand(prev: EditorState, command: EditorCommand): EditorState {
  if (command.type === 'select') {
    const { id, additive } = command.payload
    if (!prev.nodeMap[id]) {
      return prev
    }

    if (!additive) {
      if (prev.selectedIds.length === 1 && prev.selectedId === id) {
        return prev
      }
      return { ...prev, selectedId: id, selectedIds: [id] }
    }

    const exists = prev.selectedIds.includes(id)
    const nextSelectedIds = exists
      ? prev.selectedIds.filter((item) => item !== id)
      : [...prev.selectedIds, id]

    return {
      ...prev,
      selectedId: nextSelectedIds[nextSelectedIds.length - 1] ?? null,
      selectedIds: nextSelectedIds,
    }
  }

  if (command.type === 'selectAll') {
    const ids = command.payload.ids.filter((id) => Boolean(prev.nodeMap[id]))
    return {
      ...prev,
      selectedId: ids[0] ?? null,
      selectedIds: ids,
    }
  }

  if (command.type === 'setSelection') {
    const ids = command.payload.ids.filter((id) => Boolean(prev.nodeMap[id]))
    if (!command.payload.additive) {
      return {
        ...prev,
        selectedId: ids[ids.length - 1] ?? null,
        selectedIds: ids,
      }
    }
    const merged = new Set([...prev.selectedIds, ...ids])
    const nextSelectedIds = Array.from(merged)
    return {
      ...prev,
      selectedId: nextSelectedIds[nextSelectedIds.length - 1] ?? null,
      selectedIds: nextSelectedIds,
    }
  }

  if (command.type === 'clearSelection') {
    if (prev.selectedIds.length === 0) {
      return prev
    }
    return {
      ...prev,
      selectedId: null,
      selectedIds: [],
    }
  }

  if (command.type === 'move') {
    const { id, x, y } = command.payload
    const target = prev.nodeMap[id]
    if (!target || target.locked) {
      return prev
    }
    return {
      ...prev,
      nodeMap: {
        ...prev.nodeMap,
        [id]: {
          ...target,
          x: snapToGrid(x),
          y: snapToGrid(y),
        },
      },
    }
  }

  if (command.type === 'moveMany') {
    const { ids, deltaX, deltaY } = command.payload
    if (ids.length === 0 || (deltaX === 0 && deltaY === 0)) {
      return prev
    }
    const nextNodeMap = { ...prev.nodeMap }
    let changed = false
    ids.forEach((id) => {
      const node = prev.nodeMap[id]
      if (!node || node.locked) {
        return
      }
      changed = true
      nextNodeMap[id] = {
        ...node,
        x: snapToGrid(node.x + deltaX),
        y: snapToGrid(node.y + deltaY),
      }
    })
    if (!changed) {
      return prev
    }
    return { ...prev, nodeMap: nextNodeMap }
  }

  if (command.type === 'updateMany') {
    const { ids, patch } = command.payload
    if (ids.length === 0) {
      return prev
    }
    const nextNodeMap = { ...prev.nodeMap }
    let changed = false
    ids.forEach((id) => {
      const node = prev.nodeMap[id]
      if (!node) {
        return
      }
      const nextPatch = sanitizePatch(patch, node)
      nextNodeMap[id] = {
        ...node,
        ...nextPatch,
      }
      changed = true
    })
    if (!changed) {
      return prev
    }
    return { ...prev, nodeMap: nextNodeMap }
  }

  if (command.type === 'add') {
    const sanitizedNode = sanitizeNode(command.payload.node)
    if (!sanitizedNode || prev.nodeMap[sanitizedNode.id]) {
      return prev
    }
    return {
      ...prev,
      nodeMap: {
        ...prev.nodeMap,
        [sanitizedNode.id]: sanitizedNode,
      },
      rootIds: [...prev.rootIds, sanitizedNode.id],
      selectedId: sanitizedNode.id,
      selectedIds: [sanitizedNode.id],
    }
  }

  if (command.type === 'reorderRoots') {
    const { fromId, toId } = command.payload
    if (fromId === toId) {
      return prev
    }
    const fromIndex = prev.rootIds.indexOf(fromId)
    const toIndex = prev.rootIds.indexOf(toId)
    if (fromIndex < 0 || toIndex < 0) {
      return prev
    }
    const nextRootIds = [...prev.rootIds]
    const [moved] = nextRootIds.splice(fromIndex, 1)
    if (!moved) {
      return prev
    }
    nextRootIds.splice(toIndex, 0, moved)
    return {
      ...prev,
      rootIds: nextRootIds,
    }
  }

  if (command.type === 'removeMany') {
    const idsToRemove = new Set(command.payload.ids)
    if (idsToRemove.size === 0) {
      return prev
    }
    const nextNodeMap = { ...prev.nodeMap }
    let removedCount = 0
    idsToRemove.forEach((id) => {
      const node = nextNodeMap[id]
      if (!node) return
      if (node.parentId && nextNodeMap[node.parentId]) {
        const parent = nextNodeMap[node.parentId]
        nextNodeMap[node.parentId] = {
          ...parent,
          children: (parent.children ?? []).filter((cid) => cid !== id),
        }
      }
      const childIds = node.children ?? []
      childIds.forEach((childId) => {
        if (nextNodeMap[childId]) {
          nextNodeMap[childId] = { ...nextNodeMap[childId], parentId: undefined }
        }
      })
      delete nextNodeMap[id]
      removedCount += 1
    })
    if (removedCount === 0) {
      return prev
    }
    const nextRootIds = prev.rootIds.filter((id) => !idsToRemove.has(id))
    const orphanedChildren: string[] = []
    idsToRemove.forEach((id) => {
      const node = prev.nodeMap[id]
      if (!node) return
        ; (node.children ?? []).forEach((childId) => {
          if (nextNodeMap[childId] && !nextRootIds.includes(childId)) {
            orphanedChildren.push(childId)
          }
        })
    })
    const finalRootIds = [...nextRootIds, ...orphanedChildren]
    const nextSelectedIds = prev.selectedIds.filter((id) => !idsToRemove.has(id))
    return {
      ...prev,
      nodeMap: nextNodeMap,
      rootIds: finalRootIds,
      selectedId: nextSelectedIds[0] ?? finalRootIds[0] ?? null,
      selectedIds: nextSelectedIds,
    }
  }

  if (command.type === 'addToFrame') {
    const { nodeId, frameId } = command.payload
    const node = prev.nodeMap[nodeId]
    const frame = prev.nodeMap[frameId]
    if (!node || !frame || frame.type !== 'frame' || nodeId === frameId) {
      return prev
    }
    if (node.parentId === frameId) {
      return prev
    }
    const nextNodeMap = { ...prev.nodeMap }
    if (node.parentId && nextNodeMap[node.parentId]) {
      const oldParent = nextNodeMap[node.parentId]
      nextNodeMap[node.parentId] = {
        ...oldParent,
        children: (oldParent.children ?? []).filter((cid) => cid !== nodeId),
      }
    }
    nextNodeMap[nodeId] = { ...node, parentId: frameId }
    nextNodeMap[frameId] = {
      ...frame,
      children: [...(frame.children ?? []), nodeId],
    }
    const nextRootIds = prev.rootIds.filter((id) => id !== nodeId)
    return { ...prev, nodeMap: nextNodeMap, rootIds: nextRootIds }
  }

  if (command.type === 'removeFromFrame') {
    const { nodeId } = command.payload
    const node = prev.nodeMap[nodeId]
    if (!node || !node.parentId) {
      return prev
    }
    const frame = prev.nodeMap[node.parentId]
    if (!frame) {
      return prev
    }
    const nextNodeMap = { ...prev.nodeMap }
    nextNodeMap[node.parentId] = {
      ...frame,
      children: (frame.children ?? []).filter((cid) => cid !== nodeId),
    }
    nextNodeMap[nodeId] = { ...node, parentId: undefined }
    return {
      ...prev,
      nodeMap: nextNodeMap,
      rootIds: [...prev.rootIds, nodeId],
    }
  }

  return prev
}
