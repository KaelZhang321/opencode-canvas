import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EditorNode, Viewport } from '../editor-store/types'
import { CanvasView } from './CanvasView'

afterEach(() => {
  cleanup()
})

const nodes: EditorNode[] = [
  {
    id: 'text-1',
    type: 'text',
    name: 'Title',
    text: 'Hello Canvas',
    className: 'text-xl',
    x: 20,
    y: 30,
    width: 200,
    height: 56,
  },
]

const nodeMap: Record<string, EditorNode> = {
  'text-1': nodes[0],
}

const defaultViewport: Viewport = { panX: 0, panY: 0, zoom: 1 }

describe('CanvasView', () => {
  it('renders node content and type label', () => {
    render(
      <CanvasView
        nodes={nodes}
        nodeMap={nodeMap}
        selectedIds={[]}
        viewport={defaultViewport}
        onSelect={vi.fn()}
        onSetSelection={vi.fn()}
        onMove={vi.fn()}
        onMoveSelection={vi.fn()}
        onResize={vi.fn()}
        onPan={vi.fn()}
        onZoom={vi.fn()}
      />,
    )

    expect(screen.getByText('Hello Canvas')).toBeInTheDocument()
    expect(screen.getByText('文本')).toBeInTheDocument()
  })

  it('calls onSelect when node is pressed', () => {
    const onSelect = vi.fn()
    render(
      <CanvasView
        nodes={nodes}
        nodeMap={nodeMap}
        selectedIds={[]}
        viewport={defaultViewport}
        onSelect={onSelect}
        onSetSelection={vi.fn()}
        onMove={vi.fn()}
        onMoveSelection={vi.fn()}
        onResize={vi.fn()}
        onPan={vi.fn()}
        onZoom={vi.fn()}
      />,
    )

    fireEvent.mouseDown(screen.getAllByText('Hello Canvas')[0], {
      clientX: 100,
      clientY: 120,
    })

    expect(onSelect).toHaveBeenCalledWith('text-1', false)
  })

  it('shows 8 resize handles for selected node', () => {
    const { container } = render(
      <CanvasView
        nodes={nodes}
        nodeMap={nodeMap}
        selectedIds={['text-1']}
        viewport={defaultViewport}
        onSelect={vi.fn()}
        onSetSelection={vi.fn()}
        onMove={vi.fn()}
        onMoveSelection={vi.fn()}
        onResize={vi.fn()}
        onPan={vi.fn()}
        onZoom={vi.fn()}
      />,
    )

    expect(container.querySelectorAll('[data-handle]').length).toBe(8)
  })

  it('supports keyboard move for selected node', () => {
    const onMoveSelection = vi.fn()
    const onSelect = vi.fn()

    render(
      <CanvasView
        nodes={nodes}
        nodeMap={nodeMap}
        selectedIds={['text-1']}
        viewport={defaultViewport}
        onSelect={onSelect}
        onSetSelection={vi.fn()}
        onMove={vi.fn()}
        onMoveSelection={onMoveSelection}
        onResize={vi.fn()}
        onPan={vi.fn()}
        onZoom={vi.fn()}
      />,
    )

    const nodeButton = screen.getByRole('button', { name: /Title \(text\)/i })
    fireEvent.keyDown(nodeButton, { key: 'ArrowRight' })

    expect(onSelect).toHaveBeenCalledWith('text-1')
    expect(onMoveSelection).toHaveBeenCalledWith(1, 0)
  })

  it('exposes canvas region landmark', () => {
    render(
      <CanvasView
        nodes={nodes}
        nodeMap={nodeMap}
        selectedIds={[]}
        viewport={defaultViewport}
        onSelect={vi.fn()}
        onSetSelection={vi.fn()}
        onMove={vi.fn()}
        onMoveSelection={vi.fn()}
        onResize={vi.fn()}
        onPan={vi.fn()}
        onZoom={vi.fn()}
      />,
    )

    expect(screen.getByRole('region', { name: /画布区域/i })).toBeInTheDocument()
  })
})
