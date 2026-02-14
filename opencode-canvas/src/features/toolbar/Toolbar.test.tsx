import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Toolbar } from './Toolbar'

afterEach(() => {
  cleanup()
})

describe('Toolbar', () => {
  it('exposes accessible region and token controls', () => {
    render(
      <Toolbar
        onAddText={vi.fn()}
        onAddButton={vi.fn()}
        onAddFrame={vi.fn()}
        onAddImage={vi.fn()}
        onAddCard={vi.fn()}
        onAddForm={vi.fn()}
        onDelete={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        tokenTheme="ocean"
        tokenPreset="neutral"
        onTokenThemeChange={vi.fn()}
        onTokenPresetChange={vi.fn()}
        onApplyTokenPreset={vi.fn()}
        canDelete
        canUndo
        canRedo
      />,
    )

    expect(screen.getByRole('region', { name: /编辑器工具栏/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /设计令牌主题/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /设计令牌预设/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /应用令牌/i })).toBeInTheDocument()
  })
})
