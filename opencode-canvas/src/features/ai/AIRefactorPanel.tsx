import { useState } from 'react'
import type { AIProposal } from '../../core/ai/refactor'

interface AIRefactorPanelProps {
  canGenerateProposal: boolean
  loading: boolean
  collapsed: boolean
  promptHistory: string[]
  proposals: AIProposal[]
  proposalPreview: AIProposal | null
  canRevert: boolean
  statusMessage: string
  onGenerate: (prompt: string) => void | Promise<void>
  onGeneratePage: (prompt: string) => void | Promise<void>
  onApply: (proposal: AIProposal) => void
  onSelectProposal: (proposal: AIProposal) => void
  onRevert: () => void
  onToggleCollapse: () => void
}

export function AIRefactorPanel({
  canGenerateProposal,
  loading,
  collapsed,
  promptHistory,
  proposals,
  proposalPreview,
  canRevert,
  statusMessage,
  onGenerate,
  onGeneratePage,
  onApply,
  onSelectProposal,
  onRevert,
  onToggleCollapse,
}: AIRefactorPanelProps) {
  const [prompt, setPrompt] = useState('')

  if (collapsed) {
    return (
      <section className="flex h-full w-11 flex-col items-center rounded-xl border border-slate-800 bg-slate-900/70 py-3">
        <button
          type="button"
          className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:border-slate-500"
          onClick={onToggleCollapse}
        >
          AI
        </button>
        <div className="mt-3 [writing-mode:vertical-rl] text-[10px] tracking-wide text-slate-500">
          抽屉
        </div>
      </section>
    )
  }

  return (
    <section className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/70">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-sm font-medium text-slate-300">
        <span>AI 重构</span>
        <button
          type="button"
          className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:border-slate-500"
          onClick={onToggleCollapse}
        >
          收起
        </button>
      </header>
      <div className="space-y-3 overflow-auto p-3">
        <textarea
          className="min-h-20 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-sky-500"
          placeholder={canGenerateProposal ? '例：将此处改为更有感染力的主标题' : '例：创建一个包含定价的 SaaS 着陆页'}
          value={prompt}
          disabled={loading}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <button
          type="button"
          className="w-full rounded border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canGenerateProposal || loading || prompt.trim().length === 0}
          onClick={() => onGenerate(prompt)}
        >
          {loading ? '生成中...' : '生成提案（当前选中）'}
        </button>

        <button
          type="button"
          className="w-full rounded border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading || prompt.trim().length === 0}
          onClick={() => onGeneratePage(prompt)}
        >
          {loading ? '生成中...' : '生成整页'}
        </button>

        <button
          type="button"
          className="w-full rounded border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading || !canRevert}
          onClick={onRevert}
        >
          撤销上次 AI 应用
        </button>

        <div className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-400">
          {statusMessage}
        </div>

        <div className="space-y-2">
          {proposals.map((proposal) => (
            <div key={proposal.id} className="rounded-md border border-slate-800 p-2">
              <div className="text-xs font-medium text-slate-200">{proposal.title}</div>
              <div className="mt-1 text-[11px] text-slate-400">{proposal.rationale}</div>
              <button
                type="button"
                className="mt-2 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:border-slate-500"
                onClick={() => onSelectProposal(proposal)}
              >
                预览
              </button>
              <button
                type="button"
                className="ml-2 mt-2 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:border-slate-500"
                onClick={() => onApply(proposal)}
              >
                应用
              </button>
            </div>
          ))}
          {proposals.length === 0 && (
            <div className="rounded-md border border-dashed border-slate-800 p-2 text-[11px] text-slate-500">
              暂无提案
            </div>
          )}
        </div>

        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">
            提示词历史
          </div>
          <div className="max-h-20 space-y-1 overflow-auto">
            {promptHistory.map((item, index) => (
              <button
                key={`${item}-${index}`}
                className="block w-full rounded border border-slate-800 px-2 py-1 text-left text-[11px] text-slate-400 hover:border-slate-700"
                type="button"
                onClick={() => {
                  setPrompt(item)
                }}
              >
                {item}
              </button>
            ))}
            {promptHistory.length === 0 && (
              <div className="text-[11px] text-slate-500">暂无历史</div>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">
            提案预览
          </div>
          <pre className="max-h-24 overflow-auto rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-300">
            <code>{JSON.stringify(proposalPreview?.patch ?? {}, null, 2)}</code>
          </pre>
        </div>
      </div>
    </section>
  )
}
