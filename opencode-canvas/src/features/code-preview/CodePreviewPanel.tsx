import type { SemanticDiffSummary } from '../../core/code-sync'

interface CodePreviewPanelProps {
  code: string
  hasChanges: boolean
  semanticDiff: SemanticDiffSummary
  onSetBaseline: () => void
  onRollback: () => void
}

export function CodePreviewPanel({
  code,
  hasChanges,
  semanticDiff,
  onSetBaseline,
  onRollback,
}: CodePreviewPanelProps) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
        <span>生成代码预览</span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-200 hover:border-slate-500"
            onClick={onSetBaseline}
          >
            设为基准
          </button>
          <button
            type="button"
            className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onRollback}
            disabled={!hasChanges}
          >
            回滚
          </button>
        </div>
      </div>
      <pre className="h-[150px] overflow-auto rounded border border-slate-800 bg-slate-950 p-2 text-[11px] text-slate-300">
        <code>{code}</code>
      </pre>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-400">
        <div>新增: {semanticDiff.added}</div>
        <div>删除: {semanticDiff.removed}</div>
        <div>移动: {semanticDiff.moved}</div>
        <div>调整大小: {semanticDiff.resized}</div>
        <div>文本变更: {semanticDiff.textChanged}</div>
        <div>样式变更: {semanticDiff.styleChanged}</div>
      </div>
    </section>
  )
}
