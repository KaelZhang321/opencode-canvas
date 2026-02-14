import { useMemo } from 'react'
import type { EditorNode } from '../../core/editor-store/types'

interface LayersPanelProps {
  rootIds: string[]
  nodeMap: Record<string, EditorNode>
  selectedIds: string[]
  onSelect: (id: string, additive?: boolean) => void
  onReorder: (fromId: string, toId: string) => void
  onToggleLocked: (id: string) => void
  onToggleVisible: (id: string) => void
}

export function LayersPanel({
  rootIds,
  nodeMap,
  selectedIds,
  onSelect,
  onReorder,
  onToggleLocked,
  onToggleVisible,
}: LayersPanelProps) {
  const layerItems = useMemo(
    () =>
      rootIds
        .map((id) => ({ id, node: nodeMap[id] }))
        .filter((item): item is { id: string; node: EditorNode } => Boolean(item.node)),
    [nodeMap, rootIds],
  )

  const handleLayerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, id: string) => {
    const index = rootIds.indexOf(id)
    if (index < 0) {
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(id, event.metaKey || event.ctrlKey || event.shiftKey)
      return
    }

    if (!event.altKey) {
      return
    }

    if (event.key === 'ArrowUp' && index > 0) {
      event.preventDefault()
      onReorder(id, rootIds[index - 1])
      return
    }

    if (event.key === 'ArrowDown' && index < rootIds.length - 1) {
      event.preventDefault()
      onReorder(id, rootIds[index + 1])
    }
  }

  return (
    <aside className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/70" role="region" aria-label="图层面板">
      <header className="border-b border-slate-800 px-4 py-3 text-sm font-medium text-slate-300">
        图层
      </header>
      <div className="flex-1 overflow-auto p-2" role="listbox" aria-label="图层列表" aria-multiselectable="true">
        {layerItems.map(({ id, node }) => {
          const active = selectedIds.includes(id)
          return (
            <button
              key={id}
              role="option"
              aria-selected={active}
              aria-label={`${node.name} (${node.type})`}
              className={`mb-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${active
                  ? 'bg-sky-500/20 text-sky-200'
                  : 'text-slate-300 hover:bg-slate-800'
                }`}
              style={{ opacity: node.visible === false ? 0.55 : 1 }}
              onClick={(event) =>
                onSelect(id, event.metaKey || event.ctrlKey || event.shiftKey)
              }
              onDragStart={(event) => {
                if (node.locked) {
                  event.preventDefault()
                  return
                }
                event.dataTransfer.setData('text/plain', id)
                event.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(event) => {
                event.preventDefault()
                const fromId = event.dataTransfer.getData('text/plain')
                if (!fromId || fromId === id) {
                  return
                }
                onReorder(fromId, id)
              }}
              onKeyDown={(event) => handleLayerKeyDown(event, id)}
              draggable={!node.locked}
              aria-disabled={node.locked ? 'true' : 'false'}
              type="button"
            >
              <span>{node.name}</span>
              <span className="flex items-center gap-1">
                <span className="text-xs uppercase text-slate-500">{node.type}</span>
                <span
                  role="img"
                  aria-label={node.locked ? '已锁定' : '未锁定'}
                  className="text-xs"
                >
                  {node.locked ? '🔒' : '🔓'}
                </span>
                <span
                  role="img"
                  aria-label={node.visible === false ? '已隐藏' : '可见'}
                  className="text-xs"
                >
                  {node.visible === false ? '🙈' : '👁'}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <div className="border-t border-slate-800 p-2 text-xs text-slate-400">
        <div className="mb-1">图层操作</div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-slate-700 px-2 py-1 hover:border-slate-500"
            onClick={() => {
              const id = selectedIds[selectedIds.length - 1]
              if (id) onToggleLocked(id)
            }}
            disabled={selectedIds.length === 0}
          >
            切换锁定
          </button>
          <button
            type="button"
            className="rounded border border-slate-700 px-2 py-1 hover:border-slate-500"
            onClick={() => {
              const id = selectedIds[selectedIds.length - 1]
              if (id) onToggleVisible(id)
            }}
            disabled={selectedIds.length === 0}
          >
            切换可见性
          </button>
        </div>
      </div>
    </aside>
  )
}
