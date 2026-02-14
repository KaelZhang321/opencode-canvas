interface PreviewRuntimePanelProps {
  srcDoc: string
}

export function PreviewRuntimePanel({ srcDoc }: PreviewRuntimePanelProps) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
      <div className="mb-2 text-xs text-slate-400">实时预览</div>
      <iframe
        className="h-[220px] w-full rounded border border-slate-800 bg-slate-950"
        srcDoc={srcDoc}
        sandbox="allow-scripts"
        title="实时预览"
      />
    </section>
  )
}
