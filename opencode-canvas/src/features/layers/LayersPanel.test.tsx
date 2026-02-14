import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EditorNode } from '../../core/editor-store/types'
import { LayersPanel } from './LayersPanel'

afterEach(() => {
  cleanup()
})

const nodeMap: Record<string, EditorNode> = {
  'text-1': {
    id: 'text-1',
    type: 'text',
    name: 'Title',
    x: 0,
    y: 0,
    width: 200,
    height: 60,
  },
  'button-1': {
    id: 'button-1',
    type: 'button',
    name: 'CTA',
    x: 0,
    y: 80,
    width: 120,
    height: 40,
  },
}

describe('LayersPanel', () => {
  it('renders all layer items', () => {
    render(
      <LayersPanel
        rootIds={['text-1', 'button-1']}
        nodeMap={nodeMap}
        selectedIds={[]}
        onSelect={vi.fn()}
        onReorder={vi.fn()}
        onToggleLocked={vi.fn()}
        onToggleVisible={vi.fn()}
      />,
    )

    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('CTA')).toBeInTheDocument()
  })

  it('calls onSelect with additive flag when shift key is pressed', () => {
    const onSelect = vi.fn()
    render(
      <LayersPanel
        rootIds={['text-1']}
        nodeMap={nodeMap}
        selectedIds={[]}
        onSelect={onSelect}
        onReorder={vi.fn()}
        onToggleLocked={vi.fn()}
        onToggleVisible={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('option', { name: /title/i }), { shiftKey: true })
    expect(onSelect).toHaveBeenCalledWith('text-1', true)
  })

  it('calls onReorder on drop', () => {
    const onReorder = vi.fn()
    render(
      <LayersPanel
        rootIds={['text-1', 'button-1']}
        nodeMap={nodeMap}
        selectedIds={[]}
        onSelect={vi.fn()}
        onReorder={onReorder}
        onToggleLocked={vi.fn()}
        onToggleVisible={vi.fn()}
      />,
    )

    const dragSource = screen.getByRole('option', { name: /title/i })
    const dropTarget = screen.getByRole('option', { name: /cta/i })

    const dataTransfer = {
      data: '',
      setData: vi.fn((_: string, value: string) => {
        dataTransfer.data = value
      }),
      getData: vi.fn(() => dataTransfer.data),
      effectAllowed: 'move',
      dropEffect: 'move',
    }

    fireEvent.dragStart(dragSource, { dataTransfer })
    fireEvent.drop(dropTarget, { dataTransfer })

    expect(onReorder).toHaveBeenCalledWith('text-1', 'button-1')
  })

  it('supports keyboard reorder with alt + arrow', () => {
    const onReorder = vi.fn()
    render(
      <LayersPanel
        rootIds={['text-1', 'button-1']}
        nodeMap={nodeMap}
        selectedIds={[]}
        onSelect={vi.fn()}
        onReorder={onReorder}
        onToggleLocked={vi.fn()}
        onToggleVisible={vi.fn()}
      />,
    )

    const firstLayer = screen.getByRole('option', { name: /Title \(text\)/i })
    fireEvent.keyDown(firstLayer, { key: 'ArrowDown', altKey: true })

    expect(onReorder).toHaveBeenCalledWith('text-1', 'button-1')
  })

  it('exposes listbox semantics', () => {
    render(
      <LayersPanel
        rootIds={['text-1']}
        nodeMap={nodeMap}
        selectedIds={['text-1']}
        onSelect={vi.fn()}
        onReorder={vi.fn()}
        onToggleLocked={vi.fn()}
        onToggleVisible={vi.fn()}
      />,
    )

    expect(screen.getByRole('region', { name: /图层面板/i })).toBeInTheDocument()
    expect(screen.getByRole('listbox', { name: /图层列表/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Title \(text\)/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('toggles lock and visibility for selected layer', () => {
    const onToggleLocked = vi.fn()
    const onToggleVisible = vi.fn()
    render(
      <LayersPanel
        rootIds={['text-1']}
        nodeMap={nodeMap}
        selectedIds={['text-1']}
        onSelect={vi.fn()}
        onReorder={vi.fn()}
        onToggleLocked={onToggleLocked}
        onToggleVisible={onToggleVisible}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /切换锁定/i }))
    fireEvent.click(screen.getByRole('button', { name: /切换可见性/i }))

    expect(onToggleLocked).toHaveBeenCalledWith('text-1')
    expect(onToggleVisible).toHaveBeenCalledWith('text-1')
  })
})
