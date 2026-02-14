import { useEffect } from 'react'

interface UseKeyboardShortcutsActions {
  selectAllNodes: () => void
  clearSelection: () => void
  moveSelectedBy: (deltaX: number, deltaY: number) => void
  redo: () => void
  undo: () => void
  removeSelectedNode: () => void
}

export function useKeyboardShortcuts({
  selectAllNodes,
  clearSelection,
  moveSelectedBy,
  redo,
  undo,
  removeSelectedNode,
}: UseKeyboardShortcutsActions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTypingTarget =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        selectAllNodes()
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          redo()
        } else {
          undo()
        }
        return
      }

      if (event.key === 'Escape') {
        clearSelection()
        return
      }

      if (isTypingTarget) {
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        removeSelectedNode()
        return
      }

      const step = event.shiftKey ? 10 : 1
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        moveSelectedBy(0, -step)
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        moveSelectedBy(0, step)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        moveSelectedBy(-step, 0)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        moveSelectedBy(step, 0)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    clearSelection,
    moveSelectedBy,
    redo,
    removeSelectedNode,
    selectAllNodes,
    undo,
  ])
}
