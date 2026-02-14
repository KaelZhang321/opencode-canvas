interface PatchPanelProps {
  forcePatch: boolean
  onForcePatchChange: (checked: boolean) => void
  onApplyPatch: () => void
  onImportToCanvas: () => void
  onExportPatchedSource: () => void
  patchTargetSource: string
  onPatchTargetSourceChange: (value: string) => void
  statusMessage: string
  statusSuccess: boolean
  previewSource: string
}

export function PatchPanel({
  forcePatch,
  onForcePatchChange,
  onApplyPatch,
  onImportToCanvas,
  onExportPatchedSource,
  patchTargetSource,
  onPatchTargetSourceChange,
  statusMessage,
  statusSuccess,
  previewSource,
}: PatchPanelProps) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-1 text-xs text-slate-400">
        <span>补丁目标源码</span>
        <div className="flex flex-wrap gap-1.5">
          <label className="flex items-center gap-1 rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
            <input
              checked={forcePatch}
              type="checkbox"
              onChange={(event) => onForcePatchChange(event.target.checked)}
            />
            强制
          </label>
          <button
            type="button"
            className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-200 hover:border-slate-500"
            onClick={onApplyPatch}
          >
            应用补丁
          </button>
          <button
            type="button"
            className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-200 hover:border-slate-500"
            onClick={onImportToCanvas}
          >
            导入画布
          </button>
          <button
            type="button"
            className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-200 hover:border-slate-500"
            onClick={onExportPatchedSource}
          >
            导出
          </button>
        </div>
      </div>
      <textarea
        aria-label="补丁目标源码"
        className="h-[100px] w-full rounded border border-slate-800 bg-slate-950 p-2 text-[11px] text-slate-300 outline-none focus:border-sky-500"
        value={patchTargetSource}
        onChange={(event) => onPatchTargetSourceChange(event.target.value)}
      />
      <div
        className={`mt-2 text-[11px] ${statusSuccess ? 'text-emerald-300' : 'text-amber-300'
          }`}
      >
        {statusMessage}
      </div>
      <pre className="mt-2 h-[40px] overflow-auto rounded border border-slate-800 bg-slate-950 p-2 text-[11px] text-slate-300">
        <code>{previewSource}</code>
      </pre>
    </section>
  )
}
