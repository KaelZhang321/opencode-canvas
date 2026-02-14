import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { EditorStoreProvider } from './core/editor-store/store'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('App integration - import to canvas and export', () => {
  it('imports source into canvas then exports patched source', async () => {
    const createObjectURL = vi.fn(() => 'blob:test-url')
    const revokeObjectURL = vi.fn()
    const originalCreate = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    })

    try {
      render(
        <EditorStoreProvider>
          <App />
        </EditorStoreProvider>,
      )

      const source = [
        "import React from 'react'",
        '',
        'export function TargetCanvas() {',
        '  return (',
        '    <div className="relative h-[1200px] w-[1600px]">',
        '      <div key="hero-1" className="absolute text-3xl" style={{ left: 18, top: 18, width: 360, minHeight: 72 }} data-node-type="text">Imported Hero</div>',
        '    </div>',
        '  )',
        '}',
        '',
      ].join('\n')

      fireEvent.change(screen.getByLabelText(/补丁目标源码/i), {
        target: { value: source },
      })
      fireEvent.click(screen.getByRole('button', { name: '导入画布' }))

      await waitFor(() => {
        expect(screen.getByText(/已从源码导入 1 个节点/)).toBeInTheDocument()
      })

      expect(screen.getAllByText('Imported Hero')[0]).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: '导出' }))

      expect(createObjectURL).toHaveBeenCalledTimes(1)
      expect(clickSpy).toHaveBeenCalledTimes(1)
      expect(revokeObjectURL).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: originalCreate,
      })
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: originalRevoke,
      })
    }
  })
})
