import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EditorNode, Viewport } from '../editor-store/types'
import { computeFrameLayout } from '../layout-engine/yoga-bridge'

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

interface CanvasViewProps {
  nodes: EditorNode[]
  nodeMap: Record<string, EditorNode>
  selectedIds: string[]
  viewport: Viewport
  onSelect: (id: string, additive?: boolean) => void
  onSetSelection: (ids: string[], additive?: boolean) => void
  onMove: (id: string, x: number, y: number) => void
  onMoveSelection: (deltaX: number, deltaY: number) => void
  onResize: (id: string, patch: Partial<EditorNode>) => void
  onPan: (dx: number, dy: number) => void
  onZoom: (nextZoom: number, centerX: number, centerY: number) => void
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

const VIRTUALIZATION_THRESHOLD = 50
const VIRTUALIZATION_OVERSCAN = 160

function intersects(a: Rect, b: Rect) {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  )
}

export function CanvasView({
  nodes,
  nodeMap,
  selectedIds,
  viewport,
  onSelect,
  onSetSelection,
  onMove,
  onMoveSelection,
  onResize,
  onPan,
  onZoom,
}: CanvasViewProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [resizingHandle, setResizingHandle] = useState<string | null>(null)
  const [isSpaceDown, setIsSpaceDown] = useState(false)
  const [isPanning, setIsPanning] = useState(false)

  const [marqueeRect, setMarqueeRect] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)

  const [containerDimensions, setContainerDimensions] = useState<Rect>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  })

  const containerRef = useRef<HTMLDivElement | null>(null)
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const viewportRef = useRef(viewport)
  useEffect(() => { viewportRef.current = viewport }, [viewport])

  const nodesRef = useRef(nodes)
  useEffect(() => { nodesRef.current = nodes }, [nodes])

  const dragStateRef = useRef<{
    id: string
    startMouseX: number
    startMouseY: number
    startNodeX: number
    startNodeY: number
  } | null>(null)

  const resizeStateRef = useRef<{
    id: string
    handle: ResizeHandle
    startMouseX: number
    startMouseY: number
    startX: number
    startY: number
    startW: number
    startH: number
  } | null>(null)

  const marqueeStateRef = useRef<{
    startX: number
    startY: number
    additive: boolean
  } | null>(null)

  const lastMouseRef = useRef<{ x: number, y: number } | null>(null)

  const getCanvasPoint = (clientX: number, clientY: number) => {
    const container = containerRef.current
    if (!container) {
      return { x: 0, y: 0 }
    }
    const rect = container.getBoundingClientRect()
    const vp = viewportRef.current
    return {
      x: (clientX - rect.left - vp.panX) / vp.zoom,
      y: (clientY - rect.top - vp.panY) / vp.zoom,
    }
  }

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const visibleNodes = useMemo(() => {
    if (nodes.length < VIRTUALIZATION_THRESHOLD) {
      return nodes
    }

    const visibleX = -viewport.panX / viewport.zoom
    const visibleY = -viewport.panY / viewport.zoom
    const visibleW = containerDimensions.width / viewport.zoom
    const visibleH = containerDimensions.height / viewport.zoom

    const queryRect: Rect = {
      x: visibleX - VIRTUALIZATION_OVERSCAN,
      y: visibleY - VIRTUALIZATION_OVERSCAN,
      width: visibleW + VIRTUALIZATION_OVERSCAN * 2,
      height: visibleH + VIRTUALIZATION_OVERSCAN * 2,
    }

    return nodes.filter((node) => {
      if (selectedSet.has(node.id)) {
        return true
      }
      return intersects(queryRect, {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      })
    })
  }, [nodes, selectedSet, viewport, containerDimensions])

  const resizeHandleConfig: Array<{
    handle: ResizeHandle
    className: string
    cursor: string
  }> = [
      { handle: 'n', className: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'n-resize' },
      { handle: 's', className: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2', cursor: 's-resize' },
      { handle: 'e', className: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2', cursor: 'e-resize' },
      { handle: 'w', className: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2', cursor: 'w-resize' },
      { handle: 'ne', className: 'right-0 top-0 translate-x-1/2 -translate-y-1/2', cursor: 'ne-resize' },
      { handle: 'nw', className: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'nw-resize' },
      { handle: 'se', className: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2', cursor: 'se-resize' },
      { handle: 'sw', className: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2', cursor: 'sw-resize' },
    ]

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && !e.repeat && !e.metaKey && !e.ctrlKey) {
        setIsSpaceDown(true)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setIsSpaceDown(false)
        setIsPanning(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect()
      setContainerDimensions({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      })
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateDimensions)
      resizeObserver.observe(container)
    }

    return () => {
      window.removeEventListener('resize', updateDimensions)
      resizeObserver?.disconnect()
    }
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()

    if (e.ctrlKey || e.metaKey) {
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const centerX = e.clientX - rect.left
      const centerY = e.clientY - rect.top

      const zoomFactor = 1.05
      const nextZoom = e.deltaY < 0
        ? viewportRef.current.zoom * zoomFactor
        : viewportRef.current.zoom / zoomFactor

      onZoom(nextZoom, centerX, centerY)
    } else {
      onPan(-e.deltaX, -e.deltaY)
    }
  }, [onPan, onZoom])

  useEffect(() => {
    const primarySelectedId = selectedIds[0]
    if (!primarySelectedId) {
      return
    }
    nodeRefs.current[primarySelectedId]?.focus()
  }, [selectedIds])

  useEffect(() => {
    const onWindowMouseMove = (event: MouseEvent) => {
      if (isPanning) {
        if (lastMouseRef.current) {
          const dx = event.clientX - lastMouseRef.current.x
          const dy = event.clientY - lastMouseRef.current.y
          onPan(dx, dy)
        }
        lastMouseRef.current = { x: event.clientX, y: event.clientY }
        return
      }

      const point = getCanvasPoint(event.clientX, event.clientY)

      const resizeState = resizeStateRef.current
      if (resizeState) {
        const minSize = 20
        const deltaX = point.x - resizeState.startMouseX
        const deltaY = point.y - resizeState.startMouseY

        let nextX = resizeState.startX
        let nextY = resizeState.startY
        let nextW = resizeState.startW
        let nextH = resizeState.startH

        if (resizeState.handle.includes('e')) {
          nextW = Math.max(minSize, resizeState.startW + deltaX)
        }
        if (resizeState.handle.includes('s')) {
          nextH = Math.max(minSize, resizeState.startH + deltaY)
        }
        if (resizeState.handle.includes('w')) {
          const widthFromWest = resizeState.startW - deltaX
          nextW = Math.max(minSize, widthFromWest)
          nextX = resizeState.startX + (resizeState.startW - nextW)
        }
        if (resizeState.handle.includes('n')) {
          const heightFromNorth = resizeState.startH - deltaY
          nextH = Math.max(minSize, heightFromNorth)
          nextY = resizeState.startY + (resizeState.startH - nextH)
        }

        onResize(resizeState.id, {
          x: Math.round(nextX),
          y: Math.round(nextY),
          width: Math.round(nextW),
          height: Math.round(nextH),
        })
        return
      }

      const marqueeState = marqueeStateRef.current
      if (marqueeState) {
        const x = Math.min(marqueeState.startX, point.x)
        const y = Math.min(marqueeState.startY, point.y)
        const width = Math.abs(point.x - marqueeState.startX)
        const height = Math.abs(point.y - marqueeState.startY)
        setMarqueeRect({ x, y, width, height })
        return
      }

      const dragState = dragStateRef.current
      if (!dragState) {
        return
      }

      const currentNodes = nodesRef.current

      const totalDeltaX = point.x - dragState.startMouseX
      const totalDeltaY = point.y - dragState.startMouseY

      if (selectedIds.length > 1 && selectedIds.includes(dragState.id)) {
        const draggedNode = currentNodes.find(n => n.id === dragState.id)
        if (draggedNode) {
          const targetX = dragState.startNodeX + totalDeltaX
          const targetY = dragState.startNodeY + totalDeltaY

          const stepX = targetX - draggedNode.x
          const stepY = targetY - draggedNode.y

          if (Math.abs(stepX) >= 1 || Math.abs(stepY) >= 1) {
            onMoveSelection(Math.round(stepX), Math.round(stepY))
          }
        }
        return
      }

      onMove(
        dragState.id,
        Math.round(dragState.startNodeX + totalDeltaX),
        Math.round(dragState.startNodeY + totalDeltaY),
      )
    }

    const onWindowMouseUp = () => {
      const marqueeState = marqueeStateRef.current
      const rect = marqueeRect
      if (marqueeState && rect) {
        const selected = nodesRef.current
          .filter((node) =>
            intersects(
              rect,
              {
                x: node.x,
                y: node.y,
                width: node.width,
                height: node.height,
              },
            ),
          )
          .map((node) => node.id)
        onSetSelection(selected, marqueeState.additive)
      }

      dragStateRef.current = null
      resizeStateRef.current = null
      marqueeStateRef.current = null
      lastMouseRef.current = null
      setDraggingId(null)
      setResizingHandle(null)
      setMarqueeRect(null)
      setIsPanning(false)
    }

    window.addEventListener('mousemove', onWindowMouseMove)
    window.addEventListener('mouseup', onWindowMouseUp)
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove)
      window.removeEventListener('mouseup', onWindowMouseUp)
    }
  }, [marqueeRect, onMove, onMoveSelection, onResize, onSetSelection, selectedIds, isPanning, onPan])

  const handleNodeMouseDown = (
    event: React.MouseEvent<HTMLDivElement>,
    node: EditorNode,
  ) => {
    if (isSpaceDown) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    const additive = event.metaKey || event.ctrlKey || event.shiftKey
    onSelect(node.id, additive)
    if (node.locked) {
      setDraggingId(null)
      return
    }

    const point = getCanvasPoint(event.clientX, event.clientY)

    dragStateRef.current = {
      id: node.id,
      startMouseX: point.x,
      startMouseY: point.y,
      startNodeX: node.x,
      startNodeY: node.y,
    }
    setDraggingId(node.id)
  }

  const handleNodeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, node: EditorNode) => {
      const additive = event.metaKey || event.ctrlKey || event.shiftKey
      if (event.key === 'Enter' || event.key === ' ') {
        if (event.key === ' ' && !event.repeat) {
          event.preventDefault()
          onSelect(node.id, additive)
          return
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          onSelect(node.id, additive)
          return
        }
      }

      const step = event.shiftKey ? 10 : 1
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        onSelect(node.id)
        if (node.locked) return
        onMoveSelection(0, -step)
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        onSelect(node.id)
        if (node.locked) return
        onMoveSelection(0, step)
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onSelect(node.id)
        if (node.locked) return
        onMoveSelection(-step, 0)
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        onSelect(node.id)
        if (node.locked) return
        onMoveSelection(step, 0)
      }
    },
    [onMoveSelection, onSelect],
  )

  const handleCanvasMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isSpaceDown) {
      event.preventDefault()
      setIsPanning(true)
      lastMouseRef.current = { x: event.clientX, y: event.clientY }
      return
    }

    if (event.target !== event.currentTarget) {
      return
    }
    event.preventDefault()

    const point = getCanvasPoint(event.clientX, event.clientY)
    const additive = event.metaKey || event.ctrlKey || event.shiftKey
    marqueeStateRef.current = {
      startX: point.x,
      startY: point.y,
      additive,
    }
    setMarqueeRect({ x: point.x, y: point.y, width: 0, height: 0 })
  }

  const handleResizeMouseDown = (
    event: React.MouseEvent<HTMLDivElement>,
    node: EditorNode,
    handle: ResizeHandle,
  ) => {
    if (isSpaceDown) return

    event.preventDefault()
    event.stopPropagation()

    const point = getCanvasPoint(event.clientX, event.clientY)

    resizeStateRef.current = {
      id: node.id,
      handle,
      startMouseX: point.x,
      startMouseY: point.y,
      startX: node.x,
      startY: node.y,
      startW: node.width,
      startH: node.height,
    }
    setResizingHandle(handle)
    setDraggingId(null)
  }

  /** Render children inside a frame using yoga layout or absolute positioning */
  const renderFrameChildren = (frame: EditorNode) => {
    const childIds = frame.children ?? []
    if (childIds.length === 0) return null

    const children = childIds
      .map((id) => nodeMap[id])
      .filter((n): n is EditorNode => Boolean(n) && n.visible !== false)

    if (children.length === 0) return null

    // Compute layout if frame has layoutMode
    const layoutPositions: Record<string, { x: number; y: number; width: number; height: number }> = {}
    if (frame.layoutMode && frame.layoutMode !== 'none') {
      try {
        const results = computeFrameLayout(frame, children)
        results.forEach((r) => {
          layoutPositions[r.id] = { x: r.x, y: r.y, width: r.width, height: r.height }
        })
      } catch {
        // fallback to absolute positioning if yoga fails
      }
    }

    return children.map((child) => {
      const pos = layoutPositions[child.id]
      const childActive = selectedSet.has(child.id)
      const cx = pos ? pos.x : (child.x - frame.x)
      const cy = pos ? pos.y : (child.y - frame.y)
      const cw = pos ? pos.width : child.width
      const ch = pos ? pos.height : child.height

      return (
        <div
          key={child.id}
          className={`absolute rounded-md border px-2 py-1 ${child.locked ? 'cursor-not-allowed' : 'cursor-pointer'
            } ${childActive
              ? 'border-sky-400 ring-2 ring-sky-400/40'
              : 'border-slate-600 hover:border-slate-400'
            }`}
          style={{
            left: cx,
            top: cy,
            width: cw,
            minHeight: ch,
            opacity: child.locked ? 0.8 : 1,
            ...child.style,
          }}
          onMouseDown={(event) => handleNodeMouseDown(event, child)}
        >
          <div className="text-[9px] uppercase tracking-wide text-slate-500">{child.type}</div>
          <div className="truncate text-[11px] text-slate-300">{child.text || child.name}</div>
        </div>
      )
    })
  }

  const renderNodeContent = (node: EditorNode) => {
    const typeLabels: Record<string, string> = {
      text: '文本',
      button: '按钮',
      frame: '画框',
      image: '图片',
      card: '卡片',
      form: '表单',
    }
    const typeLabel = typeLabels[node.type] ?? node.type

    if (node.type === 'text') {
      return (
        <>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">{typeLabel}</div>
          <div className={node.className}>{node.text ?? node.name}</div>
        </>
      )
    }

    if (node.type === 'button') {
      return (
        <>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">{typeLabel}</div>
          <button className={node.className} style={{ pointerEvents: 'none' }}>
            {node.text ?? node.name}
          </button>
        </>
      )
    }

    if (node.type === 'frame') {
      const childCount = (node.children ?? []).length
      const layoutLabel = node.layoutMode && node.layoutMode !== 'none' ? ` · ${node.layoutMode}` : ''
      return (
        <>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide text-slate-400">
              {typeLabel}{layoutLabel}
            </span>
            {childCount > 0 && (
              <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[9px] text-slate-300">
                {childCount} 个子节点
              </span>
            )}
          </div>
          <div className="relative h-full w-full overflow-hidden">
            {renderFrameChildren(node)}
            {childCount === 0 && (
              <div className="flex h-full min-h-[60px] items-center justify-center text-xs text-slate-500">
                拖入节点到画框
              </div>
            )}
          </div>
        </>
      )
    }

    if (node.type === 'image') {
      return (
        <>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">{typeLabel}</div>
          {node.src ? (
            <img
              src={node.src}
              alt={node.name}
              className="h-full w-full rounded object-cover"
              style={{ pointerEvents: 'none' }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded bg-slate-800 text-xl text-slate-400">
              🖼
            </div>
          )}
        </>
      )
    }

    if (node.type === 'card') {
      return (
        <>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">{typeLabel}</div>
          <div className={node.className}>
            <div className="mb-2 text-sm font-medium text-slate-200">{node.text || '卡片'}</div>
            <div className="h-full rounded bg-slate-700/50" />
          </div>
        </>
      )
    }

    return (
      <>
        <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">{typeLabel}</div>
        <div className={node.className}>
          <div className="mb-2 text-sm font-medium text-slate-200">{node.text || '表单'}</div>
          <div className="space-y-2">
            <div className="h-8 w-full rounded bg-slate-700/50" />
            <div className="h-8 w-full rounded bg-slate-700/50" />
            <div className="h-8 w-24 rounded bg-sky-600/50" />
          </div>
        </div>
      </>
    )
  }

  const gridSize = 18 * viewport.zoom
  const gridStyle = {
    backgroundSize: `${gridSize}px ${gridSize}px`,
    backgroundPosition: `${viewport.panX}px ${viewport.panY}px`,
    backgroundImage: `radial-gradient(circle at 1px 1px, #1f2a44 ${1 * viewport.zoom}px, transparent 0)`
  }

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70 select-none ${isSpaceDown ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
      role="region"
      aria-label="画布区域"
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={gridStyle}
      />

      <div
        style={{
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        {visibleNodes.map((node) => {
          const active = selectedSet.has(node.id)
          return (
            <div
              key={node.id}
              ref={(el) => {
                nodeRefs.current[node.id] = el
              }}
              className={`absolute rounded-md border px-3 py-2 ${node.locked ? 'cursor-not-allowed' : 'cursor-pointer'
                } ${active
                  ? 'border-sky-400 ring-2 ring-sky-400/40'
                  : 'border-slate-700 hover:border-slate-500'
                }`}
              role="button"
              aria-label={`${node.name} (${node.type})`}
              aria-pressed={active}
              aria-disabled={node.locked ? 'true' : 'false'}
              tabIndex={0}
              style={{
                left: node.x,
                top: node.y,
                width: node.width,
                minHeight: node.height,
                opacity: node.locked ? 0.8 : 1,
                ...node.style,
              }}
              onMouseDown={(event) => handleNodeMouseDown(event, node)}
              onKeyDown={(event) => handleNodeKeyDown(event, node)}
            >
              {renderNodeContent(node)}
              {draggingId === node.id && (
                <div className="mt-1 text-[10px] text-sky-300">
                  ({node.x}, {node.y})
                </div>
              )}
              {active && !node.locked &&
                resizeHandleConfig.map((item) => (
                  <div
                    key={`${node.id}-${item.handle}`}
                    data-handle={item.handle}
                    className={`absolute h-2 w-2 rounded-sm border border-sky-300 bg-slate-950 ${item.className}`}
                    style={{
                      cursor: item.cursor,
                      boxShadow:
                        resizingHandle === item.handle ? '0 0 0 2px rgba(56, 189, 248, 0.35)' : 'none',
                    }}
                    onMouseDown={(event) => handleResizeMouseDown(event, node, item.handle)}
                  />
                ))}
            </div>
          )
        })}
        {marqueeRect && (
          <div
            className="pointer-events-none absolute border border-sky-400 bg-sky-400/15"
            style={{
              left: marqueeRect.x,
              top: marqueeRect.y,
              width: marqueeRect.width,
              height: marqueeRect.height,
            }}
          />
        )}
      </div>

      <div className="absolute bottom-4 right-4 pointer-events-none">
        <div className="bg-slate-800/80 backdrop-blur text-slate-300 text-xs px-2 py-1 rounded border border-slate-700 shadow-lg">
          {Math.round(viewport.zoom * 100)}%
        </div>
      </div>
    </div>
  )
}
