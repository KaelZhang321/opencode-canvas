import type { TokenPreset, TokenTheme } from '../../core/design-tokens/tokens'

interface ToolbarProps {
  onAddText: () => void
  onAddButton: () => void
  onAddFrame: () => void
  onAddImage: () => void
  onAddCard: () => void
  onAddForm: () => void
  onDelete: () => void
  onUndo: () => void
  onRedo: () => void
  tokenTheme: TokenTheme
  tokenPreset: TokenPreset
  onTokenThemeChange: (theme: TokenTheme) => void
  onTokenPresetChange: (preset: TokenPreset) => void
  onApplyTokenPreset: () => void
  canDelete: boolean
  canUndo: boolean
  canRedo: boolean
}

export function Toolbar({
  onAddText,
  onAddButton,
  onAddFrame,
  onAddImage,
  onAddCard,
  onAddForm,
  onDelete,
  onUndo,
  onRedo,
  tokenTheme,
  tokenPreset,
  onTokenThemeChange,
  onTokenPresetChange,
  onApplyTokenPreset,
  canDelete,
  canUndo,
  canRedo,
}: ToolbarProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-2" role="region" aria-label="编辑器工具栏">
      <div className="text-sm font-semibold tracking-wide whitespace-nowrap">Opencode Canvas</div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-slate-500"
          onClick={onAddText}
        >
          + 文本
        </button>
        <button
          type="button"
          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-slate-500"
          onClick={onAddButton}
        >
          + 按钮
        </button>
        <button
          type="button"
          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-slate-500"
          onClick={onAddFrame}
        >
          + 画框
        </button>
        <button
          type="button"
          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-slate-500"
          onClick={onAddImage}
        >
          + 图片
        </button>
        <button
          type="button"
          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-slate-500"
          onClick={onAddCard}
        >
          + 卡片
        </button>
        <button
          type="button"
          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-slate-500"
          onClick={onAddForm}
        >
          + 表单
        </button>
        <button
          type="button"
          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onDelete}
          disabled={!canDelete}
        >
          删除
        </button>
        <button
          type="button"
          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onUndo}
          disabled={!canUndo}
        >
          撤销
        </button>
        <button
          type="button"
          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onRedo}
          disabled={!canRedo}
        >
          重做
        </button>
        <select
          aria-label="设计令牌主题"
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
          value={tokenTheme}
          onChange={(event) => onTokenThemeChange(event.target.value as TokenTheme)}
        >
          <option value="ocean">主题：海洋</option>
          <option value="sunset">主题：日落</option>
          <option value="forest">主题：森林</option>
        </select>
        <select
          aria-label="设计令牌预设"
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
          value={tokenPreset}
          onChange={(event) => onTokenPresetChange(event.target.value as TokenPreset)}
        >
          <option value="neutral">预设：中性</option>
          <option value="emphasis">预设：强调</option>
          <option value="ghost">预设：幽灵</option>
        </select>
        <button
          type="button"
          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-slate-500"
          onClick={onApplyTokenPreset}
        >
          应用令牌
        </button>
        <div className="ml-1 text-xs text-slate-400">多选 + 快捷键</div>
      </div>
    </header>
  )
}
