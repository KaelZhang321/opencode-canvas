import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EditorNode } from '../editor-store/types'
import { InspectorPanel } from './InspectorPanel'

afterEach(() => {
  cleanup()
})

const imageNode: EditorNode = {
  id: 'image-1',
  type: 'image',
  name: 'Hero Image',
  text: '',
  className: 'rounded-lg',
  src: 'https://example.com/hero.jpg',
  x: 10,
  y: 20,
  width: 240,
  height: 160,
  style: {
    display: 'flex',
    backgroundColor: '#0f172a',
  },
}

describe('InspectorPanel', () => {
  it('renders empty hint when no selection', () => {
    render(<InspectorPanel nodes={[]} onTextChange={vi.fn()} onPatchChange={vi.fn()} />)
    expect(screen.getByText('请至少选择一个节点')).toBeInTheDocument()
  })

  it('commits text change on blur', () => {
    const onTextChange = vi.fn()
    const { container } = render(
      <InspectorPanel
        nodes={[imageNode]}
        onTextChange={onTextChange}
        onPatchChange={vi.fn()}
      />,
    )

    const textArea = container.querySelector('textarea')
    expect(textArea).not.toBeNull()
    if (!textArea) {
      return
    }
    fireEvent.change(textArea, { target: { value: 'Updated copy' } })
    fireEvent.blur(textArea)

    expect(onTextChange).toHaveBeenCalledWith('Updated copy')
  })

  it('updates layout style field', () => {
    const onPatchChange = vi.fn()
    render(
      <InspectorPanel
        nodes={[imageNode]}
        onTextChange={vi.fn()}
        onPatchChange={onPatchChange}
      />,
    )

    const displaySelect = screen.getByRole('combobox', { name: /显示方式/i })
    fireEvent.change(displaySelect, { target: { value: 'grid' } })

    expect(onPatchChange).toHaveBeenCalledWith({ style: { display: 'grid' } })
  })
})
